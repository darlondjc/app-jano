import type { RawTransaction } from '@jano/import-file';

/** Conta vista pelo conector (corrente, poupança ou cartão). */
export interface ConnectedAccount {
  /** Id da conta no provedor (Pluggy, arquivo...). */
  externalId: string;
  kind: 'conta' | 'cartao';
  /** Nome para exibir, ex.: "Conta Corrente" ou "Mastercard Black". */
  name: string;
  /** Agência/conta ou final do cartão, quando o provedor informa. */
  number?: string;
  /** Tipo informado pelo provedor, ex.: corrente ou poupança. */
  detail?: string;
  /** Saldo no banco. No cartão é o valor devido (positivo = deve). */
  balanceCents?: number;
  /** Quando o provedor atualizou a conta pela última vez (ISO 8601). */
  updatedAt?: string;
  /** Só em cartões, quando o provedor informa. */
  credito?: CreditoCartao;
}

/** Dados do cartão de crédito. Datas em AAAA-MM-DD; valores em centavos. */
export interface CreditoCartao {
  limiteCents: number | null;
  disponivelCents: number | null;
  /** Fechamento da fatura atual. */
  fechamento: string | null;
  /** Vencimento da fatura atual. */
  vencimento: string | null;
  minimoCents: number | null;
  /** Ex.: "Mastercard Black". */
  bandeira: string | null;
}

/** Resumo da fatura aberta, com as compras ainda pendentes. Nunca vira transação. */
export interface ResumoFatura {
  /** Primeiro dia considerado (AAAA-MM-DD). */
  desde: string;
  totalCents: number;
  compras: number;
  /** Por categoria (null = sem categoria), do maior para o menor. */
  porCategoria: { categoryId: string | null; cents: number }[];
  /** As maiores compras do período. */
  maiores: {
    nome: string;
    cents: number;
    date: string;
    categoryId: string | null;
  }[];
}

export interface FetchRange {
  /** AAAA-MM-DD, inclusivo. */
  from: string;
  /** AAAA-MM-DD, inclusivo. */
  to: string;
}

/**
 * Porta de entrada de lançamentos (plano técnico, seção 2, item 7). Quem implementa entrega
 * `RawTransaction` já no formato do app; deduplicação, categorização e prévia seguem iguais.
 */
export interface BankConnector {
  listAccounts(): Promise<ConnectedAccount[]>;
  fetchTransactions(
    account: ConnectedAccount,
    range: FetchRange,
  ): Promise<RawTransaction[]>;
}
