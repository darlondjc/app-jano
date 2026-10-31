import { proximaCobranca } from '@jano/engine';
import { cobrancasFixas, diaDaFatura, series } from '../projecoes/plano';
import { parcelamentos, type TxRec } from '../recorrencias/linhas';

export interface FaturaCartao {
  /** Fatura em aberto, do banco. */
  abertaCents: number;
  /** Vencimento previsto (AAAA-MM-DD), pelo dia em que ela costuma ser paga; null se não há histórico. */
  vence: string | null;
  /** O que a próxima fatura já tem garantido: parcelas que continuam e assinaturas do cartão. */
  proximaCents: number;
  parcelasCents: number;
  nParcelas: number;
  assinaturasCents: number;
}

export interface EntradaFatura {
  faturaCents: number;
  txs: (TxRec & { accountId: string })[];
  cartoes: ReadonlySet<string>;
  /** AAAA-MM-DD */
  hoje: string;
}

/**
 * Fatura do cartão: a em aberto (saldo do banco) com o vencimento previsto, e a próxima, que
 * começa com as parcelas ainda por vir e as assinaturas que caem no cartão todo mês. `null`
 * quando não há cartão ou nada a mostrar.
 */
export function faturaDoCartao(e: EntradaFatura): FaturaCartao | null {
  if (!e.cartoes.size) return null;
  const doCartao = e.txs.filter((t) => e.cartoes.has(t.accountId));
  const contas = e.txs.filter((t) => !e.cartoes.has(t.accountId));
  const parcelas = parcelamentos(doCartao, e.hoje).filter(
    (p) => (p.parcela?.faltam ?? 0) >= 1,
  );
  const parcelasCents = parcelas.reduce((s, p) => s + p.cents, 0);
  // Só cobranças de valor fixo (assinaturas, seguros): gasto variável que se repete, como
  // cinema ou delivery, não é compromisso da próxima fatura.
  const assinaturasCents = cobrancasFixas(
    series(
      doCartao.filter((t) => !t.installment),
      'gasto',
    ),
  ).reduce((s, { s: serie }) => s + serie.amountCents, 0);
  const abertaCents = Math.max(0, e.faturaCents);
  if (!abertaCents && !parcelasCents && !assinaturasCents) return null;
  const dia = diaDaFatura(contas);
  return {
    abertaCents,
    vence: dia === null ? null : proximaCobranca(dia, e.hoje),
    proximaCents: parcelasCents + assinaturasCents,
    parcelasCents,
    nParcelas: parcelas.length,
    assinaturasCents,
  };
}
