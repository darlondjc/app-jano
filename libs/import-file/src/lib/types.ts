/** Linha lida de um arquivo, antes de virar transação. Dinheiro em centavos, negativo = saída. */
export interface RawTransaction {
  /** AAAA-MM-DD */
  date: string;
  amountCents: number;
  /** Texto original do banco (NAME + MEMO). */
  description: string;
  /** FITID do OFX, quando existe. */
  externalId?: string;
}

export interface ParseResult {
  transactions: RawTransaction[];
  /** Linhas ignoradas por problema, com o motivo (vão para o relatório da prévia). */
  errors: { index: number; reason: string }[];
}
