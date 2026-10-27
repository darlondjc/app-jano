import type { Cents } from './engine';

/** Transação como o motor a enxerga. Gasto = valor negativo. */
export interface HistTx {
  /** AAAA-MM-DD */
  date: string;
  amountCents: Cents;
  categoryId: string | null;
  descriptionNorm: string;
  isTransfer: boolean;
}

export type Insight =
  | {
      kind: 'categoria-acima';
      categoryId: string;
      spentCents: Cents;
      avgCents: Cents;
      pct: number;
    }
  | {
      kind: 'gasto-incomum';
      description: string;
      date: string;
      amountCents: Cents;
      times: number;
    }
  | {
      kind: 'recorrencia-reajustada';
      description: string;
      fromCents: Cents;
      toCents: Cents;
      pct: number;
    }
  | {
      kind: 'nova-assinatura';
      description: string;
      amountCents: Cents;
      firstSeen: string;
    }
  | { kind: 'sequencia-metas'; categoryId: string; months: number };

export const monthOf = (date: string): string => date.slice(0, 7);

/** Os `n` meses anteriores a `month` ('AAAA-MM'), do mais recente ao mais antigo. */
export function previousMonths(month: string, n: number): string[] {
  let [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

const spends = (txs: HistTx[]) =>
  txs.filter((t) => !t.isTransfer && t.amountCents < 0);

function spentByMonthAndCategory(
  txs: HistTx[],
): Map<string, Map<string, Cents>> {
  const out = new Map<string, Map<string, Cents>>();
  for (const t of spends(txs)) {
    const month = monthOf(t.date);
    const cat = t.categoryId ?? '';
    const byCat = out.get(month) ?? out.set(month, new Map()).get(month)!;
    byCat.set(cat, (byCat.get(cat) ?? 0) + -t.amountCents);
  }
  return out;
}

/**
 * Categoria que já gastou mais de 20% acima da média dos 3 meses anteriores, com diferença
 * mínima de R$ 50. Exige ao menos 2 meses anteriores com dados. Como o mês corrente está
 * incompleto, só avisa quando mesmo o parcial já passou do normal (conservador).
 */
export function categoriesAboveNormal(
  txs: HistTx[],
  month: string,
  opts: { ratio?: number; minDiffCents?: Cents; lookback?: number } = {},
): Insight[] {
  const { ratio = 1.2, minDiffCents = 5000, lookback = 3 } = opts;
  const byMonth = spentByMonthAndCategory(txs);
  const prev = previousMonths(month, lookback).filter((m) => byMonth.has(m));
  if (prev.length < 2) return [];
  const out: Insight[] = [];
  for (const [categoryId, spentCents] of byMonth.get(month) ?? []) {
    if (categoryId === '') continue;
    const avgCents = Math.round(
      prev.reduce((s, m) => s + (byMonth.get(m)?.get(categoryId) ?? 0), 0) /
        prev.length,
    );
    if (
      avgCents > 0 &&
      spentCents > avgCents * ratio &&
      spentCents - avgCents >= minDiffCents
    ) {
      out.push({
        kind: 'categoria-acima',
        categoryId,
        spentCents,
        avgCents,
        pct: Math.round((spentCents / avgCents - 1) * 100),
      });
    }
  }
  return out.sort(
    (a, b) => b.spentCents - b.avgCents - (a.spentCents - a.avgCents),
  );
}

/**
 * Compra do mês muito acima do histórico da categoria: valor > média + 2,5 desvios e pelo
 * menos o dobro da média, com 5 ou mais compras anteriores na categoria.
 */
export function unusualTransactions(txs: HistTx[], month: string): Insight[] {
  const history = new Map<string, number[]>();
  for (const t of spends(txs)) {
    if (monthOf(t.date) < month && t.categoryId) {
      (
        history.get(t.categoryId) ??
        history.set(t.categoryId, []).get(t.categoryId)!
      ).push(-t.amountCents);
    }
  }
  const out: Insight[] = [];
  for (const t of spends(txs)) {
    const h = t.categoryId ? history.get(t.categoryId) : undefined;
    if (monthOf(t.date) !== month || !h || h.length < 5) continue;
    const mean = h.reduce((s, x) => s + x, 0) / h.length;
    const sd = Math.sqrt(h.reduce((s, x) => s + (x - mean) ** 2, 0) / h.length);
    const value = -t.amountCents;
    if (value > mean + 2.5 * sd && value >= mean * 2) {
      out.push({
        kind: 'gasto-incomum',
        description: t.descriptionNorm,
        date: t.date,
        amountCents: value,
        times: Math.round((value / mean) * 10) / 10,
      });
    }
  }
  return out.sort(
    (a, b) =>
      ('amountCents' in b ? b.amountCents : 0) -
      ('amountCents' in a ? a.amountCents : 0),
  );
}

export interface RecurringSeries {
  description: string;
  /** Valor mais recente (positivo). */
  amountCents: Cents;
  previousCents: Cents;
  /** Dia do mês típico. */
  day: number;
  months: number;
  firstSeen: string;
}

/**
 * Séries mensais: mesma descrição em 3+ meses diferentes, cobrada em dias próximos (±4) e
 * com valores dentro de 25% do último. Serve de base às recorrências da projeção.
 */
export function detectRecurrences(txs: HistTx[]): RecurringSeries[] {
  const groups = new Map<string, HistTx[]>();
  for (const t of spends(txs)) {
    (
      groups.get(t.descriptionNorm) ??
      groups.set(t.descriptionNorm, []).get(t.descriptionNorm)!
    ).push(t);
  }
  const out: RecurringSeries[] = [];
  for (const [description, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const perMonth = new Map<string, HistTx>();
    for (const t of sorted) perMonth.set(monthOf(t.date), t);
    const series = [...perMonth.values()];
    if (series.length < 3) continue;
    const days = series
      .map((t) => Number(t.date.slice(8, 10)))
      .sort((a, b) => a - b);
    const day = days[Math.floor(days.length / 2)];
    const last = -series[series.length - 1].amountCents;
    const steady = series.every(
      (t) => Math.abs(-t.amountCents - last) <= last * 0.25,
    );
    const regular = days.every((d) => Math.abs(d - day) <= 4);
    if (!steady || !regular) continue;
    out.push({
      description,
      amountCents: last,
      previousCents: -series[series.length - 2].amountCents,
      day,
      months: series.length,
      firstSeen: sorted[0].date,
    });
  }
  return out.sort((a, b) => b.amountCents - a.amountCents);
}

/** Recorrência cujo último valor subiu mais de 3% sobre o anterior. */
export function repricedRecurrences(series: RecurringSeries[]): Insight[] {
  return series
    .filter(
      (s) => s.previousCents > 0 && s.amountCents > s.previousCents * 1.03,
    )
    .map((s) => ({
      kind: 'recorrencia-reajustada' as const,
      description: s.description,
      fromCents: s.previousCents,
      toCents: s.amountCents,
      pct: Math.round((s.amountCents / s.previousCents - 1) * 1000) / 10,
    }));
}

/** Descrição de assinatura que apareceu pela primeira vez nos últimos 30 dias. */
export function newSubscriptions(
  txs: HistTx[],
  subscriptionCategoryId: string,
  today: string,
): Insight[] {
  const first = new Map<string, HistTx>();
  for (const t of [...spends(txs)].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    if (
      t.categoryId === subscriptionCategoryId &&
      !first.has(t.descriptionNorm)
    )
      first.set(t.descriptionNorm, t);
  }
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - 30);
  const cutoff = limit.toISOString().slice(0, 10);
  return [...first.values()]
    .filter((t) => t.date >= cutoff && t.date <= today)
    .map((t) => ({
      kind: 'nova-assinatura' as const,
      description: t.descriptionNorm,
      amountCents: -t.amountCents,
      firstSeen: t.date,
    }));
}

/**
 * Meses seguidos (encerrados, antes de `month`) em que a categoria ficou dentro da meta.
 * Só reporta a partir de 2 meses. Usa o limite atual para todo o histórico.
 */
export function goalStreaks(
  txs: HistTx[],
  limits: { categoryId: string; limitCents: Cents }[],
  month: string,
  maxLookback = 12,
): Insight[] {
  const byMonth = spentByMonthAndCategory(txs);
  const months = previousMonths(month, maxLookback);
  const out: Insight[] = [];
  for (const { categoryId, limitCents } of limits) {
    let streak = 0;
    for (const m of months) {
      if (
        !byMonth.has(m) ||
        (byMonth.get(m)?.get(categoryId) ?? 0) > limitCents
      )
        break;
      streak += 1;
    }
    if (streak >= 2)
      out.push({ kind: 'sequencia-metas', categoryId, months: streak });
  }
  return out.sort(
    (a, b) => ('months' in b ? b.months : 0) - ('months' in a ? a.months : 0),
  );
}

/** Gasto projetado para o fim do mês pelo ritmo atual (linear). */
export function projectMonthEnd(spentCents: Cents, pace: number): Cents {
  if (pace >= 1) return spentCents;
  return Math.round(spentCents / Math.max(pace, 0.1));
}

export interface ScorePart {
  name: 'metas-no-ritmo' | 'sobra-projetada' | 'estabilidade';
  points: number;
  max: number;
}

/**
 * Nota do mês, 0 a 100: 40 pts metas no ritmo, 30 pts sobra projetada, 30 pts estabilidade.
 * Parte sem dados suficientes sai da conta e a nota é reescalada (nunca inventa pontos).
 */
export function monthScore(input: {
  goals: { spentCents: Cents; limitCents: Cents }[];
  /** Fração do mês decorrida (0–1). */
  pace: number;
  incomeCents: Cents;
  projectedNetCents: Cents;
  /** Gasto total dos meses anteriores encerrados. */
  pastMonthlySpends: Cents[];
}): { score: number; parts: ScorePart[] } {
  const parts: ScorePart[] = [];
  const { goals, pace, incomeCents, projectedNetCents, pastMonthlySpends } =
    input;

  if (goals.length) {
    const onPace = goals.filter(
      (g) => g.limitCents > 0 && g.spentCents / g.limitCents <= pace + 0.05,
    ).length;
    parts.push({
      name: 'metas-no-ritmo',
      points: (40 * onPace) / goals.length,
      max: 40,
    });
  }
  if (incomeCents > 0) {
    const share = Math.min(
      Math.max(projectedNetCents / incomeCents / 0.2, 0),
      1,
    );
    parts.push({ name: 'sobra-projetada', points: 30 * share, max: 30 });
  }
  if (pastMonthlySpends.length >= 3) {
    const mean =
      pastMonthlySpends.reduce((s, x) => s + x, 0) / pastMonthlySpends.length;
    const sd = Math.sqrt(
      pastMonthlySpends.reduce((s, x) => s + (x - mean) ** 2, 0) /
        pastMonthlySpends.length,
    );
    const cv = mean > 0 ? sd / mean : 1;
    parts.push({
      name: 'estabilidade',
      points: 30 * Math.min(Math.max((0.5 - cv) / 0.4, 0), 1),
      max: 30,
    });
  }
  const max = parts.reduce((s, p) => s + p.max, 0);
  const got = parts.reduce((s, p) => s + p.points, 0);
  return { score: max ? Math.round((got / max) * 100) : 0, parts };
}
