import type { RawTransaction } from '@jano/import-file';
import type {
  BankConnector,
  ConnectedAccount,
  FetchRange,
} from './bank-connector';
import type {
  PluggyAccount,
  PluggyClient,
  PluggyItem,
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

  /** Estado de cada conexão: validade da autorização e última atualização com o banco. */
  listItems(): Promise<PluggyItem[]> {
    return Promise.all(this.itemIds.map((id) => this.client.getItem(id)));
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

const SUBTIPOS: Record<string, string> = {
  CHECKING_ACCOUNT: 'corrente',
  SAVINGS_ACCOUNT: 'poupança',
  CREDIT_CARD: 'cartão de crédito',
};

export function toConnectedAccount(a: PluggyAccount): ConnectedAccount {
  return {
    externalId: a.id,
    kind: a.type === 'CREDIT' ? 'cartao' : 'conta',
    name: a.marketingName || a.name,
    number: a.number ?? undefined,
    detail: SUBTIPOS[a.subtype] ?? a.subtype,
    balanceCents: a.balance == null ? undefined : toCents(a.balance),
    updatedAt: a.updatedAt,
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
    date: dataLocal(t.date),
    amountCents: kind === 'cartao' ? -cents : cents,
    description: t.descriptionRaw || t.description,
  };
  // Sem `providerId`, a chave sai de data + valor + descrição (mesmo critério da Pluggy).
  // O `id` da Pluggy não serve: muda quando o lançamento do cartão é refeito no fechamento.
  if (t.providerId) row.externalId = t.providerId;
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

const DATA_SP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
});

/**
 * A Pluggy manda a data em UTC. Meia-noite UTC é só data (o banco não informou hora) e fica
 * como está; com hora, converte para São Paulo (23h de dia 5 em Brasília é dia 6 em UTC).
 */
function dataLocal(iso: string): string {
  if (iso.length === 10 || iso.endsWith('T00:00:00.000Z'))
    return iso.slice(0, 10);
  return DATA_SP.format(new Date(iso));
}

/** Reais (número da API) em centavos inteiros. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}
