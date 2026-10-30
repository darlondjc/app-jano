import { PluggyClient, type PluggyTransaction } from './pluggy-client';
import { PluggyConnector, toRawTransaction } from './pluggy-connector';

function tx(over: Partial<PluggyTransaction>): PluggyTransaction {
  return {
    id: 't1',
    accountId: 'acc',
    date: '2026-10-05T00:00:00.000Z',
    description: 'PADARIA',
    amount: -12.5,
    currencyCode: 'BRL',
    type: 'DEBIT',
    status: 'POSTED',
    ...over,
  };
}

/** Responde por caminho e guarda as URLs pedidas. */
function fakeFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input).replace('https://api.pluggy.ai', '');
    calls.push(url);
    const body = routes[url];
    if (body === undefined) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { fn, calls };
}

describe('toRawTransaction', () => {
  it('conta: mantém o sinal e converte para centavos', () => {
    expect(toRawTransaction(tx({ amount: -12.5 }), 'conta')).toEqual({
      date: '2026-10-05',
      amountCents: -1250,
      description: 'PADARIA',
      externalId: 't1',
    });
  });

  it('cartão: compra positiva vira saída; parcela e final do cartão', () => {
    const row = toRawTransaction(
      tx({
        amount: 100.1,
        creditCardMetadata: {
          installmentNumber: 2,
          totalInstallments: 6,
          cardNumber: '1234567812345678',
        },
      }),
      'cartao',
    );
    expect(row.amountCents).toBe(-10010);
    expect(row.installment).toEqual({ n: 2, total: 6 });
    expect(row.holder).toBe('5678');
  });

  it('cartão: pagamento da fatura é transferência', () => {
    const row = toRawTransaction(
      tx({ amount: -800, operationType: 'PAGAMENTO_FATURA' }),
      'cartao',
    );
    expect(row.amountCents).toBe(80000);
    expect(row.isTransfer).toBe(true);
  });

  it('prefere a descrição crua do banco', () => {
    const row = toRawTransaction(
      tx({ description: 'Padaria', descriptionRaw: 'COMPRA CARTAO PADARIA X' }),
      'conta',
    );
    expect(row.description).toBe('COMPRA CARTAO PADARIA X');
  });
});

describe('PluggyConnector', () => {
  const credentials = { clientId: 'id', clientSecret: 'secret' };

  it('autentica uma vez, lista contas e segue o cursor das transações', async () => {
    const { fn, calls } = fakeFetch({
      '/auth': { apiKey: 'k' },
      '/accounts?itemId=item1': {
        results: [
          {
            id: 'card',
            type: 'CREDIT',
            subtype: 'CREDIT_CARD',
            name: 'Cartão',
            number: 'xxxx8670',
            balance: 1209.5,
            currencyCode: 'BRL',
            itemId: 'item1',
          },
        ],
      },
      '/v2/transactions?accountId=card&dateFrom=2026-10-01&dateTo=2026-10-31': {
        results: [tx({ id: 'a', amount: 10 })],
        next: '?accountId=card&after=c1',
      },
      '/v2/transactions?accountId=card&after=c1': {
        results: [
          tx({ id: 'b', amount: 20 }),
          tx({ id: 'p', amount: 5, status: 'PENDING' }),
        ],
        next: null,
      },
    });
    const connector = new PluggyConnector(
      new PluggyClient(credentials, { fetch: fn }),
      ['item1'],
    );

    const [account] = await connector.listAccounts();
    expect(account).toEqual({
      externalId: 'card',
      kind: 'cartao',
      name: 'Cartão',
      number: 'xxxx8670',
      balanceCents: 120950,
    });

    const rows = await connector.fetchTransactions(account, {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(rows.map((r) => [r.externalId, r.amountCents])).toEqual([
      ['a', -1000],
      ['b', -2000],
    ]);
    expect(calls.filter((c) => c === '/auth')).toHaveLength(1);
  });

  it('erro da API vira PluggyError com o código', async () => {
    const fn = (async () =>
      new Response(
        JSON.stringify({
          codeDescription: 'CLIENT_KEYS_UNAUTHORIZED',
          message: 'bad keys',
        }),
        { status: 401 },
      )) as typeof fetch;
    const client = new PluggyClient(credentials, { fetch: fn });
    await expect(client.listAccounts('x')).rejects.toMatchObject({
      name: 'PluggyError',
      status: 401,
      codeDescription: 'CLIENT_KEYS_UNAUTHORIZED',
    });
  });
});
