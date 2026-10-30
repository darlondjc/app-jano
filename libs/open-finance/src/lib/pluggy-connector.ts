import type { RawTransaction } from '@jano/import-file';
import type {
  BankConnector,
  ConnectedAccount,
  FetchRange,
} from './bank-connector';
import type {
  PluggyAccount,
  PluggyClient,
  PluggyTransaction,
} from './pluggy-client';

/** Operações do cartão que só mexem no saldo da fatura, sem ser gasto. */
const CARTAO_TRANSFERENCIA = new Set(['PAGAMENTO_FATURA']);

/**
 * Conector Open Finance via Pluggy. Com o Meu Pluggy (uso pessoal) os `itemIds` são as
 * conexões que você autorizou no dashboard; cada item é um banco.
 */
export class PluggyConnector implements BankConnector {
  constructor(
    private readonly client: PluggyClient,
    private readonly itemIds: readonly string[],
  ) {}

  async listAccounts(): Promise<ConnectedAccount[]> {
    const perItem = await Promise.all(
      this.itemIds.map((id) => this.client.listAccounts(id)),
    );
    return perItem.flat().map(toConnectedAccount);
  }

  async fetchTransactions(
    account: ConnectedAccount,
    range: FetchRange,
  ): Promise<RawTransaction[]> {
    const rows = await this.client.listTransactions(account.externalId, range);
    return rows
      .filter((t) => t.status === 'POSTED')
      .map((t) => toRawTransaction(t, account.kind));
  }
}

export function toConnectedAccount(a: PluggyAccount): ConnectedAccount {
  return {
    externalId: a.id,
    kind: a.type === 'CREDIT' ? 'cartao' : 'conta',
    name: a.marketingName || a.name,
    number: a.number ?? undefined,
    balanceCents: a.balance == null ? undefined : toCents(a.balance),
  };
}

/**
 * Pluggy → formato do app (centavos, negativo = saída).
 * No cartão a Pluggy usa o sinal do saldo devedor (compra positiva), então invertemos.
 */
export function toRawTransaction(
  t: PluggyTransaction,
  kind: ConnectedAccount['kind'],
): RawTransaction {
  const cents = toCents(t.amount);
  const meta = t.creditCardMetadata;
  const row: RawTransaction = {
    // A data vem como meia-noite UTC; converter para São Paulo jogaria para o dia anterior.
    date: t.date.slice(0, 10),
    amountCents: kind === 'cartao' ? -cents : cents,
    description: t.descriptionRaw || t.description,
    externalId: t.id,
  };
  if (
    meta?.installmentNumber &&
    meta.totalInstallments &&
    meta.totalInstallments > 1
  ) {
    row.installment = {
      n: meta.installmentNumber,
      total: meta.totalInstallments,
    };
  }
  if (meta?.cardNumber) row.holder = meta.cardNumber.slice(-4);
  if (t.category) row.bankCategory = t.category;
  if (
    kind === 'cartao' &&
    t.operationType &&
    CARTAO_TRANSFERENCIA.has(t.operationType)
  ) {
    row.isTransfer = true;
  }
  return row;
}

/** Reais (número da API) em centavos inteiros. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}
