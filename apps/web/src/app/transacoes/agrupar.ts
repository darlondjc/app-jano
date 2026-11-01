import type { TransactionDoc } from '@jano/data-access';

export interface DayGroup {
  date: string;
  label: string;
  items: TransactionDoc[];
  /** Soma do dia sem transferências (negativo = saiu mais do que entrou). */
  totalCents: number;
}

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-10-22" → "Quinta, 22 de outubro" (sem depender de fuso). */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${d} de ${MONTHS[m - 1]}`;
}

/** Agrupa por dia, do mais recente ao mais antigo, mantendo a ordem dentro do dia. */
export function agruparPorDia(txs: TransactionDoc[]): DayGroup[] {
  const map = new Map<string, TransactionDoc[]>();
  for (const t of [...txs].sort((a, b) => b.date.localeCompare(a.date))) {
    (map.get(t.date) ?? map.set(t.date, []).get(t.date)!).push(t);
  }
  return [...map].map(([date, items]) => ({
    date,
    label: dayLabel(date),
    items,
    totalCents: items
      .filter((t) => !t.isTransfer)
      .reduce((s, t) => s + t.amountCents, 0),
  }));
}

export function mesAnterior(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function mesSeguinte(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function rotuloMes(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const nome = MONTHS[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${y}`;
}

/** Mês corrente no fuso do usuário (toISOString usaria UTC e virava o mês cedo demais). */
export function mesAtual(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Classe de cor do valor: verde entrada, vermelho saída, cinza transferência. */
export function classeValor(t: {
  amountCents: number;
  isTransfer: boolean;
}): string {
  const tom = t.isTransfer ? 'neutral' : t.amountCents > 0 ? 'in' : 'out';
  return `j-tx__amount j-num j-tx__amount--${tom}`;
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

/** "2026-10-27" → "27 out". */
export function dataCurta(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MESES_CURTOS[m - 1]}`;
}
