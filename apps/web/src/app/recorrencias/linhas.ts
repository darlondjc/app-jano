import {
  detectRecurrences,
  proximaCobranca,
  type HistTx,
  type RecurringSeries,
} from '@jano/engine';
import { estabelecimento } from '@jano/import-file';

export interface TxRec extends HistTx {
  description: string;
  accountId?: string;
  /** Parcela "n de total" de uma compra parcelada. */
  installment?: { n: number; total: number };
}

export type Grupo = 'assinaturas' | 'contas' | 'parcelamentos' | 'entradas';

export const GRUPOS: { grupo: Grupo; titulo: string }[] = [
  { grupo: 'assinaturas', titulo: 'Assinaturas' },
  { grupo: 'contas', titulo: 'Contas fixas' },
  { grupo: 'parcelamentos', titulo: 'Parcelamentos' },
  { grupo: 'entradas', titulo: 'Entradas' },
];

export interface LinhaRecorrencia {
  nome: string;
  categoryId: string | null;
  cents: number;
  previousCents: number;
  /** Variação do último valor sobre o anterior, em %, com uma casa. */
  pct: number;
  day: number;
  meses: number;
  tipo: 'gasto' | 'entrada';
  grupo: Grupo;
  /** AAAA-MM-DD */
  proxima: string;
  reajustada: boolean;
  nova: boolean;
  /** Só em parcelamentos: parcela atual, quantas faltam e o mês da última (AAAA-MM). */
  parcela?: { n: number; total: number; faltam: number; termina: string };
}

function diasAtras(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function somarMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Compras parceladas em andamento, pela parcela que o banco informa (n de total). Agrupa
 * pela conta, descrição, número de parcelas e valor; fica a parcela mais recente. Some
 * quando a última foi paga ou quando nenhuma parcela aparece há 45 dias (quitada antes).
 */
export function parcelamentos(txs: TxRec[], hoje: string): LinhaRecorrencia[] {
  const ultimas = new Map<
    string,
    TxRec & { installment: { n: number; total: number } }
  >();
  for (const t of txs) {
    if (!t.installment || t.amountCents >= 0 || t.isTransfer) continue;
    const chave = `${t.accountId ?? ''}|${t.descriptionNorm}|${t.installment.total}|${t.amountCents}`;
    const antes = ultimas.get(chave);
    if (!antes || t.installment.n > antes.installment.n)
      ultimas.set(chave, { ...t, installment: t.installment });
  }
  const limite = diasAtras(hoje, 45);
  const out: LinhaRecorrencia[] = [];
  for (const t of ultimas.values()) {
    const { n, total } = t.installment;
    const faltam = total - n;
    if (faltam <= 0 || t.date < limite) continue;
    const day = Number(t.date.slice(8));
    out.push({
      nome: t.description,
      categoryId: t.categoryId,
      cents: -t.amountCents,
      previousCents: -t.amountCents,
      pct: 0,
      day,
      meses: n,
      tipo: 'gasto',
      grupo: 'parcelamentos',
      proxima: proximaCobranca(day, hoje),
      reajustada: false,
      nova: false,
      parcela: {
        n,
        total,
        faltam,
        termina: somarMeses(t.date.slice(0, 7), faltam),
      },
    });
  }
  return out;
}

/**
 * Cobranças e entradas que se repetem todo mês, da próxima para a mais distante, em grupos:
 * assinaturas (categoria Assinaturas), contas fixas (as outras cobranças), parcelamentos
 * (compras parceladas em andamento) e entradas.
 */
export function montarRecorrencias(
  todas: TxRec[],
  hoje: string,
  assinaturasId: string | null = 'assinaturas',
): LinhaRecorrencia[] {
  // Parcela não é conta fixa: tem fim. Fica só em parcelamentos.
  // Agrupa pela loja: a compra no débito traz a hora na descrição e nunca se repetiria.
  const txs = todas
    .filter((t) => !t.installment)
    .map((t) => ({
      ...t,
      descriptionNorm: estabelecimento(t.descriptionNorm),
    }));
  const ultimo = new Map<string, TxRec>();
  for (const t of [...txs].sort((a, b) => a.date.localeCompare(b.date)))
    ultimo.set(t.descriptionNorm, t);

  const monta = (
    series: RecurringSeries[],
    tipo: LinhaRecorrencia['tipo'],
  ): LinhaRecorrencia[] =>
    series.map((s) => {
      const t = ultimo.get(s.description);
      const pct =
        s.previousCents > 0
          ? Math.round((s.amountCents / s.previousCents - 1) * 1000) / 10
          : 0;
      const categoryId = t?.categoryId ?? null;
      return {
        nome: t?.description ?? s.description,
        categoryId,
        cents: s.amountCents,
        previousCents: s.previousCents,
        pct,
        day: s.day,
        meses: s.months,
        tipo,
        grupo:
          tipo === 'entrada'
            ? 'entradas'
            : categoryId && categoryId === assinaturasId
              ? 'assinaturas'
              : 'contas',
        proxima: proximaCobranca(s.day, hoje),
        reajustada: pct > 3,
        nova: s.firstSeen >= diasAtras(hoje, 75),
      };
    });

  return [
    ...monta(detectRecurrences(txs, 'gasto'), 'gasto'),
    ...monta(detectRecurrences(txs, 'entrada'), 'entrada'),
    ...parcelamentos(todas, hoje),
  ].sort((a, b) => a.proxima.localeCompare(b.proxima) || b.cents - a.cents);
}

/** Linhas de cada grupo, na ordem da tela, só os grupos que têm algo. */
export function porGrupo(linhas: LinhaRecorrencia[]): {
  grupo: Grupo;
  titulo: string;
  linhas: LinhaRecorrencia[];
  total: number;
}[] {
  return GRUPOS.map((g) => {
    const doGrupo = linhas.filter((l) => l.grupo === g.grupo);
    return {
      ...g,
      linhas: doGrupo,
      total: doGrupo.reduce((s, l) => s + l.cents, 0),
    };
  }).filter((g) => g.linhas.length);
}

/** Total mensal das recorrências de um tipo. */
export function totalMensal(
  linhas: LinhaRecorrencia[],
  tipo: LinhaRecorrencia['tipo'],
): number {
  return linhas.filter((l) => l.tipo === tipo).reduce((s, l) => s + l.cents, 0);
}
