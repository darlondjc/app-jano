import {
  detectRecurrences,
  proximaCobranca,
  type HistTx,
  type RecurringSeries,
} from '@jano/engine';

export interface EntradaPodeGastar {
  /** Saldo de hoje nas contas (corrente e poupança), do banco. */
  saldoCents: number;
  /** Fatura em aberto dos cartões (positivo = devido). */
  faturaCents: number;
  /** Histórico de alguns meses, só das contas (sem cartão: compras do cartão já estão na fatura). */
  txs: HistTx[];
  /** AAAA-MM-DD */
  hoje: string;
}

export interface PodeGastar {
  /** Data prevista do próximo salário (AAAA-MM-DD). */
  salario: string;
  dias: number;
  /** Contas fixas que vencem antes do salário e ainda não foram pagas neste mês. */
  contasCents: number;
  faturaCents: number;
  /** Saldo menos fatura e contas; pode ser negativo. */
  livreCents: number;
  /** Livre dividido pelos dias até o salário; zero quando não sobra. */
  porDiaCents: number;
}

/** Entrada recorrente abaixo disso não conta como salário (rendimento, reembolso). */
const SALARIO_MINIMO = 50_000;

const dias = (de: string, ate: string): number =>
  Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) /
      86_400_000,
  );

/** A série já caiu neste mês (mesmo valor, ±25%, perto do dia de costume)? */
function jaVeioNoMes(s: RecurringSeries, txs: HistTx[], hoje: string): boolean {
  const mes = hoje.slice(0, 7);
  return txs.some(
    (t) =>
      t.date.startsWith(mes) &&
      t.date <= hoje &&
      !t.isTransfer &&
      Math.abs(Number(t.date.slice(8)) - s.day) <= 4 &&
      Math.abs(Math.abs(t.amountCents) - s.amountCents) <= s.amountCents * 0.25,
  );
}

/**
 * Quanto dá para gastar por dia até o próximo salário: saldo das contas, menos a fatura do
 * cartão em aberto e as contas fixas que vencem antes do salário. O salário é a maior entrada
 * recorrente do histórico; sem uma, não há previsão (`null`).
 */
export function podeGastar(e: EntradaPodeGastar): PodeGastar | null {
  const salario = detectRecurrences(e.txs, 'entrada')
    .filter((s) => s.amountCents >= SALARIO_MINIMO)
    .sort((a, b) => b.amountCents - a.amountCents)[0];
  if (!salario) return null;
  let data = proximaCobranca(salario.day, e.hoje);
  // Já recebido neste mês: o próximo é o do mês que vem.
  if (
    data.slice(0, 7) === e.hoje.slice(0, 7) &&
    jaVeioNoMes(salario, e.txs, e.hoje)
  ) {
    const [y, m] = e.hoje.split('-').map(Number);
    const seguinte =
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    data = proximaCobranca(salario.day, seguinte);
  }
  const contasCents = detectRecurrences(e.txs, 'gasto')
    .filter((s) => {
      const vence = proximaCobranca(s.day, e.hoje);
      return vence < data && !jaVeioNoMes(s, e.txs, e.hoje);
    })
    .reduce((soma, s) => soma + s.amountCents, 0);
  const faturaCents = Math.max(0, e.faturaCents);
  const livreCents = e.saldoCents - faturaCents - contasCents;
  const n = Math.max(1, dias(e.hoje, data));
  return {
    salario: data,
    dias: n,
    contasCents,
    faturaCents,
    livreCents,
    porDiaCents: livreCents > 0 ? Math.floor(livreCents / n / 100) * 100 : 0,
  };
}
