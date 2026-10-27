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

/** Linha de transação para formatação em pt-BR. */
export function formatBRL(cents: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
