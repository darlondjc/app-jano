import {
  diaNoPeriodo,
  monthOf,
  monthTotals,
  previousMonths,
  type SpendTx,
} from '@jano/engine';

type Tx = SpendTx & { date: string; accountId?: string };

export interface ComparacaoNoDia {
  /** Do mês mais antigo ao atual, somando só até o mesmo dia do mês. */
  gastos: number[];
  receitas: number[];
}

/**
 * Gasto e receita de cada período até o mesmo dia de hoje, para comparar o atual com os
 * anteriores de forma justa (dia 12 contra dia 12, não contra o período inteiro).
 */
export function comparacaoNoDia(
  txs: Tx[],
  month: string,
  dia: number,
  mesesAntes: number,
  cartoes?: ReadonlySet<string>,
): ComparacaoNoDia {
  const meses = [...previousMonths(month, mesesAntes).reverse(), month];
  const out: ComparacaoNoDia = { gastos: [], receitas: [] };
  for (const m of meses) {
    const doMes = txs.filter(
      (t) => monthOf(t.date) === m && diaNoPeriodo(t.date) <= dia,
    );
    const r = monthTotals(doMes, cartoes);
    out.gastos.push(r.spent);
    out.receitas.push(r.income);
  }
  return out;
}

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Selo de variação contra o mês anterior. `subirEBom`: em receita, subir é bom; em gasto, não.
 * Abaixo de 3% de diferença conta como igual. Sem base no mês anterior, sem selo.
 */
export function variacao(
  serie: number[],
  mesAnterior: string,
  subirEBom: boolean,
  /** Nome do período anterior; sem ele, a abreviação do mês ("set"). */
  nomeAnterior?: string,
): { texto: string; tom: 'good' | 'bad' | 'neutral' } | null {
  if (serie.length < 2) return null;
  const atual = serie[serie.length - 1];
  const antes = serie[serie.length - 2];
  if (antes <= 0) return null;
  const pct = Math.round((atual / antes - 1) * 100);
  const nome =
    nomeAnterior ?? MESES_CURTOS[Number(mesAnterior.slice(5, 7)) - 1];
  if (Math.abs(pct) < 3)
    return {
      texto: nomeAnterior ? `igual ao anterior` : `igual a ${nome}`,
      tom: 'neutral',
    };
  const subiu = pct > 0;
  return {
    texto: `${subiu ? '+' : '−'}${Math.abs(pct)}% que ${nome}`,
    tom: subiu === subirEBom ? 'good' : 'bad',
  };
}
