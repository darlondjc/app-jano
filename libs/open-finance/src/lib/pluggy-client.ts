/**
 * Cliente mínimo da API da Pluggy (https://docs.pluggy.ai). Só leitura: autenticação, contas
 * e transações. Precisa de `clientSecret`, então roda só no servidor ou em script local,
 * nunca no navegador.
 */

export const PLUGGY_API = 'https://api.pluggy.ai';

/** A chave vale 2 h; renova um pouco antes para não estourar no meio de uma leitura. */
const API_KEY_TTL_MS = 110 * 60 * 1000;

export interface PluggyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface PluggyAccount {
  id: string;
  type: 'BANK' | 'CREDIT';
  subtype: string;
  name: string;
  marketingName?: string | null;
  number?: string | null;
  balance?: number | null;
  currencyCode: string;
  itemId: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  /** ISO 8601 em UTC. */
  date: string;
  description: string;
  descriptionRaw?: string | null;
  /** Em reais. Conta: negativo = saída. Cartão: positivo = compra, negativo = pagamento. */
  amount: number;
  currencyCode: string;
  type: 'DEBIT' | 'CREDIT';
  status: 'PENDING' | 'POSTED';
  category?: string | null;
  operationType?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    cardNumber?: string | null;
  } | null;
}

export class PluggyError extends Error {
  constructor(
    readonly status: number,
    readonly codeDescription: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'PluggyError';
  }
}

export interface PluggyClientOptions {
  /** Injetável para testes. */
  fetch?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
}

export class PluggyClient {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly now: () => number;
  private apiKey: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: PluggyCredentials,
    options: PluggyClientOptions = {},
  ) {
    this.fetchFn = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? PLUGGY_API;
    this.now = options.now ?? Date.now;
  }

  /** Contas de um item (uma conexão com um banco). */
  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const page = await this.get<{ results: PluggyAccount[] }>(
      `/accounts?itemId=${encodeURIComponent(itemId)}`,
    );
    return page.results;
  }

  /** Todas as transações da conta no período, seguindo o cursor de `/v2/transactions`. */
  async listTransactions(
    accountId: string,
    range: { from: string; to: string },
  ): Promise<PluggyTransaction[]> {
    const params = new URLSearchParams({
      accountId,
      dateFrom: range.from,
      dateTo: range.to,
    });
    let query: string | null = `?${params}`;
    const all: PluggyTransaction[] = [];
    while (query) {
      const page: { results: PluggyTransaction[]; next: string | null } =
        await this.get(`/v2/transactions${query}`);
      all.push(...page.results);
      // `next` já traz filtros e cursor; usar como veio, sem montar nem decodificar.
      query = page.next;
    }
    return all;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      headers: { 'X-API-KEY': await this.getApiKey() },
    });
    if (res.status === 401) this.apiKey = null;
    return this.parse<T>(res);
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKey && this.apiKey.expiresAt > this.now()) {
      return this.apiKey.value;
    }
    const res = await this.fetchFn(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.credentials),
    });
    const { apiKey } = await this.parse<{ apiKey: string }>(res);
    this.apiKey = { value: apiKey, expiresAt: this.now() + API_KEY_TTL_MS };
    return apiKey;
  }

  private async parse<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new PluggyError(
        res.status,
        body?.codeDescription,
        body?.message ?? `Pluggy respondeu ${res.status}`,
      );
    }
    return body as T;
  }
}
