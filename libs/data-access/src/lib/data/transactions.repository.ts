import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  setDoc,
  query,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore/lite';
import { hashKey, type KeyedTransaction } from '@jano/import-file';
import { paths } from '../firebase/paths';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import { monthBounds, type TransactionDoc } from './models';

const BATCH_LIMIT = 400; // Firestore aceita 500 operações por lote.
/** Quanto tempo um mês lido vale na memória antes de reler. */
const VALIDADE_MS = 10 * 60_000;
/**
 * A sincronização traz lançamentos de até 45 dias atrás (o cartão chega quando a fatura
 * fecha). Mês que terminou antes disso está fechado: só muda por edição, que fica registrada
 * em `meta/meses`.
 */
const JANELA_DIAS = 45;

/** Mês (AAAA-MM) que já não recebe lançamentos da sincronização. */
export function mesFechado(month: string, hoje = new Date()): boolean {
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - JANELA_DIAS);
  const ultimoDia = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  );
  return ultimoDia < limite;
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesAnterior(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function mesSeguinte(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class TransactionsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  /**
   * O plano gratuito do Firestore dá 50 mil leituras por dia, e as telas pedem de 1 a 7 meses.
   * Para não reler sem necessidade:
   * - memória: cada mês lido vale `VALIDADE_MS` para todas as telas;
   * - aparelho: mês fechado (ver `mesFechado`) é lido do servidor uma vez e depois vem do
   *   IndexedDB, até `meta/meses` dizer que ele mudou (edição aqui, em outro aparelho ou pela
   *   sincronização). Mês aberto sempre volta ao servidor.
   * As escritas deste repositório atualizam memória, aparelho e `meta/meses`.
   */
  private readonly memoria = new Map<
    string,
    { em: number; txs: TransactionDoc[] }
  >();
  private readonly alteracoesLidas = new Map<
    string,
    { em: number; meses: Record<string, string> }
  >();

  listMonth(uid: string, month: string): Promise<TransactionDoc[]> {
    return this.mes(uid, month);
  }

  /** Do primeiro dia de `fromMonth` ao último de `toMonth` (AAAA-MM), mais novo primeiro. */
  async listRange(
    uid: string,
    fromMonth: string,
    toMonth: string,
  ): Promise<TransactionDoc[]> {
    const meses: string[] = [];
    for (let m = fromMonth; m <= toMonth; m = mesSeguinte(m)) meses.push(m);
    const porMes = await Promise.all(meses.map((m) => this.mes(uid, m)));
    return porMes.reverse().flat();
  }

  private async mes(uid: string, month: string): Promise<TransactionDoc[]> {
    const chave = `${uid}|${month}`;
    const m = this.memoria.get(chave);
    if (m && Date.now() - m.em < VALIDADE_MS) return [...m.txs];
    const local = `${uid}|tx|${month}`;
    if (mesFechado(month)) {
      const g = await this.cache.guardado<TransactionDoc[]>(local);
      const mudou = g && (await this.alteracoes(uid))[month];
      if (g && !(mudou && mudou > g.em)) {
        this.memoria.set(chave, { em: Date.now(), txs: g.valor });
        return [...g.valor];
      }
    }
    const txs = await this.cache.ler(local, () =>
      this.listMonthDoServidor(uid, month),
    );
    this.memoria.set(chave, { em: Date.now(), txs });
    return [...txs];
  }

  /** `meta/meses`: quando cada mês mudou pela última vez. Uma leitura a cada `VALIDADE_MS`. */
  private async alteracoes(uid: string): Promise<Record<string, string>> {
    const a = this.alteracoesLidas.get(uid);
    if (a && Date.now() - a.em < VALIDADE_MS) return a.meses;
    const meses = await this.cache
      .ler(`${uid}|meta-meses`, async () => {
        const d = await getDoc(doc(this.db, paths.meta(uid), 'meses'));
        return (d.exists() ? d.data() : {}) as Record<string, string>;
      })
      .catch(() => ({}) as Record<string, string>);
    this.alteracoesLidas.set(uid, { em: Date.now(), meses });
    return meses;
  }

  /** Avisa os outros aparelhos (e a próxima sessão) que esses meses fechados mudaram. */
  private async marcarAlterados(uid: string, meses: Iterable<string>) {
    const agora = new Date().toISOString();
    const fechados = [...new Set(meses)].filter((m) => mesFechado(m));
    if (!fechados.length) return;
    const campos = Object.fromEntries(fechados.map((m) => [m, agora]));
    await setDoc(doc(this.db, paths.meta(uid), 'meses'), campos, {
      merge: true,
    });
    const a = this.alteracoesLidas.get(uid);
    if (a) Object.assign(a.meses, campos);
  }

  private async listMonthDoServidor(
    uid: string,
    month: string,
  ): Promise<TransactionDoc[]> {
    const { from, toExclusive } = monthBounds(month);
    const snap = await getDocs(
      query(
        collection(this.db, paths.transactions(uid)),
        where('date', '>=', from),
        where('date', '<', toExclusive),
        orderBy('date', 'desc'),
      ),
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<TransactionDoc, 'id'>),
    }));
  }

  /**
   * O histórico inteiro, para "alterar as passadas". A primeira vez neste aparelho lê tudo do
   * servidor e guarda mês a mês; depois só os meses abertos ou alterados voltam ao servidor.
   */
  private async tudo(uid: string): Promise<TransactionDoc[]> {
    const indice = `${uid}|tx-meses`;
    const g = await this.cache.guardado<string[]>(indice);
    if (!g) {
      const snap = await getDocs(collection(this.db, paths.transactions(uid)));
      const porMes = new Map<string, TransactionDoc[]>();
      for (const d of snap.docs) {
        const t = { id: d.id, ...(d.data() as Omit<TransactionDoc, 'id'>) };
        const m = t.date.slice(0, 7);
        (porMes.get(m) ?? porMes.set(m, []).get(m)!).push(t);
      }
      for (const [m, txs] of porMes) {
        txs.sort((a, b) => b.date.localeCompare(a.date));
        this.memoria.set(`${uid}|${m}`, { em: Date.now(), txs });
        await this.cache.guardar(`${uid}|tx|${m}`, txs);
      }
      await this.cache.guardar(indice, [...porMes.keys()]);
      return [...porMes.values()].flat();
    }
    const meses = new Set([
      ...g.valor,
      ...Object.keys(await this.alteracoes(uid)),
      mesAtual(),
      mesAnterior(mesAtual()),
      mesAnterior(mesAnterior(mesAtual())),
    ]);
    return (await Promise.all([...meses].map((m) => this.mes(uid, m)))).flat();
  }

  /** Esquece o que foi lido (ao apagar os dados da conta). */
  esquecer(): void {
    this.memoria.clear();
    this.alteracoesLidas.clear();
  }

  /**
   * Depois de gravar: aplica a mudança na memória e no aparelho, para a próxima tela não
   * reler, e marca os meses fechados como alterados para os outros aparelhos.
   */
  private async registrar(
    uid: string,
    ids: Iterable<string>,
    mudanca: Partial<TransactionDoc>,
  ): Promise<void> {
    const alvo = new Set(ids);
    const tocados: string[] = [];
    for (const [k, v] of this.memoria) {
      if (!k.startsWith(`${uid}|`) || !v.txs.some((t) => alvo.has(t.id)))
        continue;
      v.txs = v.txs.map((t) => {
        if (!alvo.has(t.id)) return t;
        const novo = { ...t, ...mudanca };
        if ('splits' in mudanca && mudanca.splits === undefined)
          delete novo.splits;
        return novo;
      });
      tocados.push(k.slice(uid.length + 1));
    }
    await this.marcarAlterados(uid, tocados);
    // Guardado depois da marca: a cópia do aparelho fica mais nova que a alteração.
    for (const m of tocados) {
      const v = this.memoria.get(`${uid}|${m}`);
      if (v) await this.cache.guardar(`${uid}|tx|${m}`, v.txs);
    }
  }

  /** Um lançamento pelo id; `null` se não existe mais. */
  async get(uid: string, id: string): Promise<TransactionDoc | null> {
    const d = await getDoc(doc(this.db, paths.transactions(uid), id));
    return d.exists()
      ? { id: d.id, ...(d.data() as Omit<TransactionDoc, 'id'>) }
      : null;
  }

  /** Mesma alteração em vários lançamentos (seleção múltipla, regra aplicada ao período). */
  async bulkUpdate(
    uid: string,
    ids: string[],
    patch: Pick<
      TransactionDoc,
      'categoryId' | 'categoryIsManual' | 'isTransfer'
    >,
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const id of ids.slice(i, i + BATCH_LIMIT)) {
        // Escolher uma categoria (ou transferência) desfaz a divisão.
        batch.update(doc(this.db, paths.transactions(uid), id), {
          ...patch,
          splits: deleteField(),
        });
      }
      await batch.commit();
    }
    await this.registrar(uid, ids, { ...patch, splits: undefined });
  }

  /** Chaves já gravadas no período do arquivo (para a prévia). */
  async existingKeys(
    uid: string,
    from: string,
    to: string,
  ): Promise<Set<string>> {
    const snap = await getDocs(
      query(
        collection(this.db, paths.transactions(uid)),
        where('date', '>=', from),
        where('date', '<=', to),
      ),
    );
    return new Set(snap.docs.map((d) => d.get('dedupeKey') as string));
  }

  /** Grava só as novas, já com a categoria sugerida. O id do documento é o hash da chave. */
  async commitImport(
    uid: string,
    accountId: string,
    importId: string,
    rows: { tx: KeyedTransaction; categoryId: string | null }[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const { tx, categoryId } of rows.slice(i, i + BATCH_LIMIT)) {
        const id = await hashKey(tx.dedupeKey);
        const data: Omit<TransactionDoc, 'id'> = {
          accountId,
          date: tx.date,
          amountCents: tx.amountCents,
          description: tx.description,
          descriptionNorm: tx.descriptionNorm,
          dedupeKey: tx.dedupeKey,
          categoryId,
          categoryIsManual: false,
          isTransfer: tx.isTransfer ?? false,
          importId,
          ...(tx.holder ? { holder: tx.holder } : {}),
          ...(tx.installment ? { installment: tx.installment } : {}),
        };
        batch.set(doc(this.db, paths.transactions(uid), id), data);
      }
      await batch.commit();
    }
    // Lançamentos novos: os meses deles voltam a ser lidos do servidor, aqui e nos outros aparelhos.
    const meses = new Set(rows.map(({ tx }) => tx.date.slice(0, 7)));
    for (const m of meses) this.memoria.delete(`${uid}|${m}`);
    await this.marcarAlterados(uid, meses);
    const indice = await this.cache.guardado<string[]>(`${uid}|tx-meses`);
    if (indice)
      await this.cache.guardar(`${uid}|tx-meses`, [
        ...new Set([...indice.valor, ...meses]),
      ]);
  }

  async setCategory(
    uid: string,
    id: string,
    categoryId: string | null,
  ): Promise<void> {
    await updateDoc(doc(this.db, paths.transactions(uid), id), {
      categoryId,
      categoryIsManual: true,
      isTransfer: false,
      splits: deleteField(),
    });
    await this.registrar(uid, [id], {
      categoryId,
      categoryIsManual: true,
      isTransfer: false,
      splits: undefined,
    });
  }

  /**
   * Divide em categorias (partes já validadas por `validarDivisao`). A categoria principal
   * vira a da maior parte, para listas e filtros que mostram uma só.
   */
  async setSplits(
    uid: string,
    id: string,
    splits: { categoryId: string; amountCents: number }[],
  ): Promise<string> {
    const principal = [...splits].sort(
      (a, b) => a.amountCents - b.amountCents,
    )[0].categoryId;
    await updateDoc(doc(this.db, paths.transactions(uid), id), {
      splits,
      categoryId: principal,
      categoryIsManual: true,
      isTransfer: false,
    });
    await this.registrar(uid, [id], {
      splits,
      categoryId: principal,
      categoryIsManual: true,
      isTransfer: false,
    });
    return principal;
  }

  /**
   * "Alterar também as transações passadas": todo lançamento gravado cuja descrição contém o
   * trecho passa para a categoria, como escolha sua (a sincronização não troca depois).
   * Transferências e lançamentos divididos ficam como estão. Devolve os ids alterados.
   */
  async aplicarAsPassadas(
    uid: string,
    pattern: string,
    categoryId: string,
  ): Promise<string[]> {
    const alvo = (await this.tudo(uid)).filter(
      (t) =>
        t.descriptionNorm.includes(pattern) &&
        !t.isTransfer &&
        !t.splits?.length &&
        !(t.categoryId === categoryId && t.categoryIsManual),
    );
    for (let i = 0; i < alvo.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const t of alvo.slice(i, i + BATCH_LIMIT))
        batch.update(doc(this.db, paths.transactions(uid), t.id), {
          categoryId,
          categoryIsManual: true,
        });
      await batch.commit();
    }
    const ids = alvo.map((t) => t.id);
    await this.registrar(uid, ids, { categoryId, categoryIsManual: true });
    return ids;
  }

  /**
   * "Para revisar": confirma a categoria que veio sozinha, sem mudá-la. Passa a contar como
   * escolha sua, que a sincronização não troca.
   */
  async confirmar(uid: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const id of ids.slice(i, i + BATCH_LIMIT))
        batch.update(doc(this.db, paths.transactions(uid), id), {
          categoryIsManual: true,
        });
      await batch.commit();
    }
    await this.registrar(uid, ids, { categoryIsManual: true });
  }

  /** Marca à mão como transferência (fora dos totais). */
  async setTransfer(uid: string, id: string): Promise<void> {
    await updateDoc(doc(this.db, paths.transactions(uid), id), {
      categoryId: null,
      categoryIsManual: true,
      isTransfer: true,
      splits: deleteField(),
    });
    await this.registrar(uid, [id], {
      categoryId: null,
      categoryIsManual: true,
      isTransfer: true,
      splits: undefined,
    });
  }

  /** Marca em lote (detecção automática); não mexe na escolha manual de categoria. */
  async markTransfers(uid: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const id of ids.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc(this.db, paths.transactions(uid), id), {
          isTransfer: true,
        });
      }
      await batch.commit();
    }
    await this.registrar(uid, ids, { isTransfer: true });
  }
}
