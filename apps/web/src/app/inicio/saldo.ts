import type { BalanceDoc } from '@jano/data-access';

export interface SaldoAtual {
  cents: number;
  /** Quais contas entram, ex.: "Conta corrente e poupança". */
  legenda: string;
  /** Atualização mais recente entre as contas somadas (ISO 8601). */
  atualizadoEm: string;
}

/**
 * Saldo de hoje: soma das contas do banco (corrente e poupança). Cartão fica de fora, porque
 * o saldo dele é dívida. `null` quando ainda não há sincronização Open Finance.
 */
export function saldoAtual(balances: BalanceDoc[]): SaldoAtual | null {
  const contas = balances.filter((b) => b.kind === 'conta');
  if (!contas.length) return null;
  const tipos = new Set(contas.map((b) => b.detail));
  const legenda =
    tipos.size === 2 && tipos.has('corrente') && tipos.has('poupança')
      ? 'Conta corrente e poupança'
      : contas.length === 1 && contas[0].detail === 'corrente'
        ? 'Conta corrente'
        : contas.length === 1 && contas[0].detail === 'poupança'
          ? 'Poupança'
          : 'Contas no banco';
  const atualizadoEm = contas
    .map((b) => b.bankUpdatedAt ?? b.syncedAt)
    .sort()
    .at(-1) as string;
  return {
    cents: contas.reduce((s, b) => s + b.balanceCents, 0),
    legenda,
    atualizadoEm,
  };
}
