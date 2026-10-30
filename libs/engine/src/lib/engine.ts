import { signal } from '@angular/core';

/** Dinheiro sempre em centavos inteiros. */
export type Cents = number;

export type GoalStatus = 'ok' | 'warning' | 'over';

/** Verde < 80%, âmbar 80–99%, vermelho ≥ 100% do limite. */
export function goalStatus(spent: Cents, limit: Cents): GoalStatus {
  if (limit <= 0) return spent > 0 ? 'over' : 'ok';
  const ratio = spent / limit;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

/** Fração do mês já decorrida (dia atual ÷ dias do mês). `month` é 1–12. */
export function monthPace(year: number, month: number, day: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(Math.max(day / daysInMonth, 0), 1);
}

/**
 * Modo "ocultar valores": quando ligado, todo valor formatado vira máscara.
 * É um signal, então telas que formatam dentro de template ou computed atualizam sozinhas.
 */
export const valoresOcultos = signal(false);

export const MASCARA_VALOR = 'R$ ••••••';

/** Valor em reais no formato pt-BR (ou a máscara, com os valores ocultos). */
export function formatBRL(cents: Cents): string {
  if (valoresOcultos()) return MASCARA_VALOR;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/** Campos mínimos de uma transação para os cálculos do mês. */
export interface SpendTx {
  categoryId: string | null;
  amountCents: Cents;
  isTransfer: boolean;
}

export interface MonthTotals {
  /** Gasto por categoria (positivo). Chave "" = sem categoria. */
  spentByCategory: Record<string, Cents>;
  spent: Cents;
  income: Cents;
  /** Receitas menos gastos do mês. */
  net: Cents;
}

/** Soma do mês: transferências entre contas próprias ficam fora de gastos e receitas. */
export function monthTotals(txs: SpendTx[]): MonthTotals {
  const spentByCategory: Record<string, Cents> = {};
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (t.isTransfer) continue;
    if (t.amountCents < 0) {
      const key = t.categoryId ?? '';
      spentByCategory[key] = (spentByCategory[key] ?? 0) + -t.amountCents;
      spent += -t.amountCents;
    } else {
      income += t.amountCents;
    }
  }
  return { spentByCategory, spent, income, net: income - spent };
}

export interface BudgetRow {
  categoryId: string;
  limitCents: Cents;
  spentCents: Cents;
  status: GoalStatus;
}

/** Uma linha por meta, na ordem recebida. Categoria sem gasto conta zero. */
export function budgetRows(
  budgets: { categoryId: string; limitCents: Cents }[],
  spentByCategory: Record<string, Cents>,
): BudgetRow[] {
  return budgets.map((b) => {
    const spentCents = spentByCategory[b.categoryId] ?? 0;
    return { ...b, spentCents, status: goalStatus(spentCents, b.limitCents) };
  });
}

/** Dias que faltam no mês, sem contar o dia atual já gasto. */
export function daysLeftInMonth(
  year: number,
  month: number,
  day: number,
): number {
  return Math.max(new Date(year, month, 0).getDate() - day, 0);
}

/** As `n` metas mais perto (ou além) do limite, da mais apertada para a mais folgada. */
export function tightestGoals(rows: BudgetRow[], n: number): BudgetRow[] {
  const ratio = (r: BudgetRow) =>
    r.limitCents > 0
      ? r.spentCents / r.limitCents
      : r.spentCents > 0
        ? Infinity
        : 0;
  return [...rows].sort((a, b) => ratio(b) - ratio(a)).slice(0, n);
}

/**
 * Gasto acumulado dia a dia (centavos), do dia 1 até `upToDay`. Só saídas, sem transferências.
 * Posição 0 = fim do dia 1.
 */
export function cumulativeSpend(
  txs: { date: string; amountCents: Cents; isTransfer: boolean }[],
  upToDay: number,
): Cents[] {
  const perDay = new Array<Cents>(Math.max(upToDay, 0)).fill(0);
  for (const t of txs) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const day = Number(t.date.slice(8, 10));
    if (day >= 1 && day <= upToDay) perDay[day - 1] += -t.amountCents;
  }
  let acc = 0;
  return perDay.map((v) => (acc += v));
}
