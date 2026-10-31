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
  accountId?: string;
  /** Divisão em categorias; a soma das partes é igual a `amountCents`. */
  splits?: Parte[];
}

/** Uma parte de um lançamento dividido em categorias. Mesmo sinal do lançamento. */
export interface Parte {
  categoryId: string | null;
  amountCents: Cents;
}

/** Partes de um lançamento: as da divisão ou, sem divisão, ele inteiro na sua categoria. */
export function partes(t: {
  categoryId: string | null;
  amountCents: Cents;
  splits?: Parte[];
}): Parte[] {
  return t.splits?.length
    ? t.splits
    : [{ categoryId: t.categoryId, amountCents: t.amountCents }];
}

export type ResultadoDivisao =
  { ok: true } | { ok: false; motivo: string; faltaCents?: Cents };

/**
 * Confere uma divisão antes de gravar: só saídas, duas partes ou mais, cada uma com categoria
 * própria e valor, e a soma fechando o total. `faltaCents` positivo = falta distribuir;
 * negativo = passou do total.
 */
export function validarDivisao(
  amountCents: Cents,
  divisao: Parte[],
): ResultadoDivisao {
  if (amountCents >= 0)
    return { ok: false, motivo: 'Só dá para dividir uma saída.' };
  if (divisao.length < 2)
    return { ok: false, motivo: 'Divida em pelo menos duas categorias.' };
  if (divisao.some((p) => !p.categoryId))
    return { ok: false, motivo: 'Escolha a categoria de cada parte.' };
  if (new Set(divisao.map((p) => p.categoryId)).size < divisao.length)
    return { ok: false, motivo: 'Cada categoria aparece uma vez só.' };
  // A soma vem antes: "faltam R$ X" ajuda mais enquanto a pessoa digita.
  const falta = divisao.reduce((s, p) => s + p.amountCents, 0) - amountCents;
  if (falta !== 0)
    return {
      ok: false,
      motivo:
        falta > 0
          ? 'Falta distribuir uma parte.'
          : 'As partes passam do total.',
      faltaCents: falta,
    };
  if (divisao.some((p) => p.amountCents >= 0))
    return { ok: false, motivo: 'Cada parte precisa ter um valor.' };
  return { ok: true };
}

/**
 * Crédito em conta de cartão (estorno, reembolso): não é receita, abate o gasto.
 * `cartoes` = ids das contas do tipo cartão.
 */
export function ehEstorno(
  t: { amountCents: Cents; isTransfer: boolean; accountId?: string },
  cartoes?: ReadonlySet<string>,
): boolean {
  return (
    !t.isTransfer &&
    t.amountCents > 0 &&
    !!t.accountId &&
    !!cartoes?.has(t.accountId)
  );
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
export function monthTotals(
  txs: SpendTx[],
  cartoes?: ReadonlySet<string>,
): MonthTotals {
  const spentByCategory: Record<string, Cents> = {};
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (t.isTransfer) continue;
    if (ehEstorno(t, cartoes)) {
      // Estorno abate o gasto da categoria (sem ficar negativo) e não conta como receita.
      const key = t.categoryId ?? '';
      const abate = Math.min(t.amountCents, spentByCategory[key] ?? 0);
      spentByCategory[key] = (spentByCategory[key] ?? 0) - abate;
      spent -= abate;
    } else if (t.amountCents < 0) {
      for (const p of partes(t)) {
        const key = p.categoryId ?? '';
        spentByCategory[key] = (spentByCategory[key] ?? 0) + -p.amountCents;
      }
      spent += -t.amountCents;
    } else {
      income += t.amountCents;
    }
  }
  return { spentByCategory, spent, income, net: income - spent };
}

/**
 * Rollover: meta com `rollover` ganha de folga o que sobrou no mês anterior (limite menos
 * gasto, nunca negativo). Só um mês: a sobra não se acumula sem fim, e estouro não passa.
 * `null` = mês anterior sem dados (nada importado): sem folga, para não inventar sobra.
 */
export function limitesComSobra<
  B extends { categoryId: string; limitCents: Cents; rollover?: boolean },
>(
  budgets: B[],
  gastoMesAnterior: Record<string, Cents> | null,
): (B & { sobraCents: Cents })[] {
  return budgets.map((b) => {
    const sobraCents =
      b.rollover && gastoMesAnterior
        ? Math.max(0, b.limitCents - (gastoMesAnterior[b.categoryId] ?? 0))
        : 0;
    return { ...b, limitCents: b.limitCents + sobraCents, sobraCents };
  });
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
  txs: {
    date: string;
    amountCents: Cents;
    isTransfer: boolean;
    accountId?: string;
  }[],
  upToDay: number,
  cartoes?: ReadonlySet<string>,
): Cents[] {
  const perDay = new Array<Cents>(Math.max(upToDay, 0)).fill(0);
  for (const t of txs) {
    if (t.isTransfer) continue;
    const estorno = ehEstorno(t, cartoes);
    if (t.amountCents >= 0 && !estorno) continue;
    const day = Number(t.date.slice(8, 10));
    if (day >= 1 && day <= upToDay) perDay[day - 1] -= t.amountCents;
  }
  let acc = 0;
  return perDay.map((v) => (acc += v));
}
