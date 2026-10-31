import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
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
/** Quanto tempo um mês lido vale antes de reler (a sincronização roda uma vez por dia). */
const VALIDADE_MS = 10 * 60_000;

function mesSeguinte(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class TransactionsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  /**
   * Meses já lidos nesta sessão, reaproveitados entre as telas por `VALIDADE_MS`. O plano
   * gratuito do Firestore dá 50 mil leituras por dia, e cada tela pede de 4 a 7 meses; sem
   * isso, navegar um pouco esgota a cota. As escritas deste repositório atualizam a memória.
   */
  private readonly memoria = new Map<
    string,
    { em: number; txs: TransactionDoc[] }
  >();
  /** Quando o histórico inteiro foi lido (para "alterar as passadas"), por usuário. */
  private readonly tudoEm = new Map<string, number>();

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
    const txs = await this.cache.ler(`${uid}|tx|${month}`, () =>
      this.listMonthDoServidor(uid, month),
    );
    this.memoria.set(chave, { em: Date.now(), txs });
    return [...txs];
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

  /** O histórico inteiro, lido uma vez por sessão e guardado mês a mês na memória. */
  private async tudo(uid: string): Promise<TransactionDoc[]> {
    const em = this.tudoEm.get(uid);
    if (!em || Date.now() - em >= VALIDADE_MS) {
      const snap = await getDocs(collection(this.db, paths.transactions(uid)));
      const porMes = new Map<string, TransactionDoc[]>();
      for (const d of snap.docs) {
        const t = { id: d.id, ...(d.data() as Omit<TransactionDoc, 'id'>) };
        const m = t.date.slice(0, 7);
        (porMes.get(m) ?? porMes.set(m, []).get(m)!).push(t);
      }
      const agora = Date.now();
      for (const [k] of this.memoria)
        if (k.startsWith(`${uid}|`)) this.memoria.delete(k);
      for (const [m, txs] of porMes)
        this.memoria.set(`${uid}|${m}`, {
          em: agora,
          txs: txs.sort((a, b) => b.date.localeCompare(a.date)),
        });
      this.tudoEm.set(uid, agora);
    }
    return [...this.memoria]
      .filter(([k]) => k.startsWith(`${uid}|`))
      .flatMap(([, v]) => v.txs);
  }

  /** Esquece o que foi lido (ao apagar os dados da conta). */
  esquecer(): void {
    this.memoria.clear();
    this.tudoEm.clear();
  }

  /** Aplica na memória o que acabou de ser gravado, para a próxima tela não reler. */
  private alterarNaMemoria(
    uid: string,
    ids: Iterable<string>,
    mudanca: Partial<TransactionDoc>,
  ): void {
    const alvo = new Set(ids);
    for (const [k, v] of this.memoria) {
      if (!k.startsWith(`${uid}|`)) continue;
      v.txs = v.txs.map((t) => {
        if (!alvo.has(t.id)) return t;
        const novo = { ...t, ...mudanca };
        if ('splits' in mudanca && mudanca.splits === undefined)
          delete novo.splits;
        return novo;
      });
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
    this.alterarNaMemoria(uid, ids, { ...patch, splits: undefined });
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
    // Lançamentos novos: os meses deles voltam a ser lidos do servidor.
    for (const { tx } of rows)
      this.memoria.delete(`${uid}|${tx.date.slice(0, 7)}`);
    this.tudoEm.delete(uid);
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
    this.alterarNaMemoria(uid, [id], {
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
    this.alterarNaMemoria(uid, [id], {
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
    this.alterarNaMemoria(uid, ids, { categoryId, categoryIsManual: true });
    return ids;
  }

  /** Marca à mão como transferência (fora dos totais). */
  async setTransfer(uid: string, id: string): Promise<void> {
    await updateDoc(doc(this.db, paths.transactions(uid), id), {
      categoryId: null,
      categoryIsManual: true,
      isTransfer: true,
      splits: deleteField(),
    });
    this.alterarNaMemoria(uid, [id], {
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
    this.alterarNaMemoria(uid, ids, { isTransfer: true });
  }
}
