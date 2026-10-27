/** Linha lida de um arquivo, antes de virar transação. Dinheiro em centavos, negativo = saída. */
export interface RawTransaction {
  /** AAAA-MM-DD */
  date: string;
  amountCents: number;
  /** Texto original do banco (NAME + MEMO). */
  description: string;
  /** FITID do OFX, quando existe. */
  externalId?: string;
  /** Final do cartão do titular (faturas com mais de um cartão). */
  holder?: string;
  /** Parcela "n de total", quando a linha é uma parcela de compra parcelada. */
  installment?: { n: number; total: number };
  /** Grupo que o próprio banco usou na fatura ("Restaurantes", "Transporte"...). */
  bankCategory?: string;
  /** Pagamento da fatura é transferência entre contas próprias, não gasto. */
  isTransfer?: boolean;
}

export interface ParseResult {
  transactions: RawTransaction[];
  /** Linhas ignoradas por problema, com o motivo (vão para o relatório da prévia). */
  errors: { index: number; reason: string }[];
}
