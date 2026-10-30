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
  balanceCents?: number;
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
