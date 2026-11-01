/**
 * Movimentações que só trocam o dinheiro de lugar (pagar a fatura do cartão, aplicar ou
 * resgatar investimento) e por isso não são gasto nem receita. Recebe a descrição normalizada.
 * É uma heurística: o usuário pode marcar ou desmarcar manualmente cada lançamento.
 */
/** Pagamento da fatura do cartão pela conta corrente ("PGTO CARTAO", "PAGTO CARTAO CREDITO"). */
const PAGAMENTO_DE_FATURA: RegExp[] = [
  /\b(PAGAMENTO|PGTO|PAGTO|PAG)\b.*\b(FATURA|CARTAO|OUROCARD)\b/,
  /\b(FATURA|OUROCARD)\b.*\b(PAGAMENTO|PGTO|PAGTO)\b/,
  /^(FATURA|OUROCARD)\b/,
];

/**
 * É o pagamento da fatura? Ele sai da conta, mas não é gasto novo: as compras do cartão já
 * contam uma a uma, e contar o pagamento também dobraria o gasto.
 */
export function ehPagamentoDeFatura(descriptionNorm: string): boolean {
  return PAGAMENTO_DE_FATURA.some((p) => p.test(descriptionNorm));
}

const PADROES: RegExp[] = [
  ...PAGAMENTO_DE_FATURA,
  // Aplicações e resgates (BB Rende Fácil, poupança, CDB, fundos).
  /\bRENDE? FACIL\b/, // o extrato abrevia: "REND.FACIL"
  /\bAPLICACAO\b/,
  /\bRESGATE\b/,
  /\bPOUPANCA\b/,
  /\b(BB )?CDB\b/,
  /\bBB (RF|RENDA FIXA|FUNDO)\b/,
];

export function isLikelyTransfer(descriptionNorm: string): boolean {
  return PADROES.some((p) => p.test(descriptionNorm));
}
