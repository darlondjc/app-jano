import { addDedupeKeys } from '@jano/import-file';
import { categorizar, inferirPeloHistorico } from './categorizar';
import { deCategoriaPluggy, deMcc } from './categorias';
import { toRawTransaction } from './pluggy-connector';
import type { PluggyTransaction } from './pluggy-client';

const tx = (over: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: 't',
  accountId: 'a',
  date: '2026-10-05T00:00:00.000Z',
  description: 'LOJA QUALQUER',
  amount: -50,
  currencyCode: 'BRL',
  type: 'DEBIT',
  status: 'POSTED',
  ...over,
});

describe('categorias da Pluggy e MCC', () => {
  it('traduz a árvore da Pluggy para as categorias do Jano', () => {
    expect(deCategoriaPluggy('Groceries')).toEqual({ nome: 'Mercado' });
    expect(deCategoriaPluggy('Eating out')).toEqual({ nome: 'Restaurantes' });
    expect(deCategoriaPluggy('Gas stations')).toEqual({ nome: 'Combustível' });
    expect(deCategoriaPluggy('Transfer - PIX')).toEqual({});
    expect(deCategoriaPluggy(null)).toEqual({});
  });

  it('transferência entre contas próprias, aplicação e fatura ficam fora', () => {
    for (const c of [
      'Same person transfer - PIX',
      'Automatic investment',
      'Credit card payment',
    ])
      expect(deCategoriaPluggy(c)).toEqual({ transferencia: true });
  });

  it('MCC por faixa', () => {
    expect(deMcc(5411)).toBe('Mercado');
    expect(deMcc(5812)).toBe('Restaurantes');
    expect(deMcc(5541)).toBe('Combustível');
    expect(deMcc(5912)).toBe('Farmácia');
    expect(deMcc(3020)).toBe('Viagens');
    expect(deMcc(1)).toBeUndefined();
    expect(deMcc(null)).toBeUndefined();
  });

  it('o conector sugere pela Pluggy e, sem ela, pelo MCC', () => {
    expect(
      toRawTransaction(tx({ category: 'Groceries' }), 'conta')
        .suggestedCategory,
    ).toBe('Mercado');
    expect(
      toRawTransaction(
        tx({ amount: 80, creditCardMetadata: { payeeMCC: 5812 } }),
        'cartao',
      ).suggestedCategory,
    ).toBe('Restaurantes');
    expect(
      toRawTransaction(tx({ category: 'Automatic investment' }), 'conta')
        .isTransfer,
    ).toBe(true);
  });

  it('categoria de entrada não vale para saída', () => {
    expect(
      toRawTransaction(tx({ category: 'Salary', amount: -100 }), 'conta')
        .suggestedCategory,
    ).toBeUndefined();
    expect(
      toRawTransaction(tx({ category: 'Salary', amount: 100 }), 'conta')
        .suggestedCategory,
    ).toBe('Receita');
  });

  it('regra do usuário e dicionário vêm antes da sugestão da fonte', () => {
    const cats = [
      { id: 'mercado', name: 'Mercado' },
      { id: 'restaurantes', name: 'Restaurantes' },
      { id: 'compras', name: 'Compras' },
    ];
    const rows = addDedupeKeys('c', [
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'LOJA X',
        suggestedCategory: 'Mercado',
      },
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'IFOOD',
        suggestedCategory: 'Mercado',
      },
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'LOJA Y',
        suggestedCategory: 'Mercado',
      },
    ]);
    const r = categorizar(rows, cats, [
      { pattern: 'LOJA Y', categoryId: 'compras' },
    ]);
    expect(r.map((x) => x.categoryId)).toEqual([
      'mercado',
      'restaurantes',
      'compras',
    ]);
  });

  it('pula a fonte cuja categoria não existe na conta', () => {
    const rows = addDedupeKeys('c', [
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'POSTO SHELL',
        suggestedCategory: 'Combustível',
      },
    ]);
    // O dicionário diria "Transporte", que esta conta não tem.
    const r = categorizar(
      rows,
      [{ id: 'combustivel', name: 'Combustível' }],
      [],
    );
    expect(r[0].categoryId).toBe('combustivel');
  });

  it('na sincronização, vence a regra mais específica e a genérica não vale', () => {
    const rows = addDedupeKeys('cc', [
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'COMPRA C/CARTAO 05/10 10:00 MATEUS SUPERMERCADOS',
      },
      {
        date: '2026-10-05',
        amountCents: -100,
        description: 'COMPRA C/CARTAO 05/10 11:00 LOJA NOVA',
      },
    ]);
    const r = categorizar(
      rows,
      [
        { id: 'mercado', name: 'Mercado' },
        { id: 'compras', name: 'Compras' },
        { id: 'lazer', name: 'Lazer' },
      ],
      [
        { pattern: 'COMPRA C CARTAO', categoryId: 'lazer' },
        { pattern: 'MATEUS', categoryId: 'compras' },
        { pattern: 'MATEUS SUPERMERCADOS', categoryId: 'mercado' },
      ],
    );
    expect(r.map((x) => x.categoryId)).toEqual(['mercado', null]);
  });
});

describe('inferirPeloHistorico', () => {
  const cats = [
    { id: 'mercado', name: 'Mercado' },
    { id: 'restaurantes', name: 'Restaurantes' },
  ];
  const l = (
    id: string,
    descriptionNorm: string,
    categoryId: string | null,
    over: { categoryIsManual?: boolean; isTransfer?: boolean } = {},
  ) => ({
    id,
    descriptionNorm,
    categoryId,
    categoryIsManual: false,
    isTransfer: false,
    ...over,
  });

  it('compra no débito sem categoria recebe a da mesma loja, ignorando prefixo e hora', () => {
    expect(
      inferirPeloHistorico(
        [
          l('a', 'COMPRA C CARTAO 09 03 MATEUS SUPERM', 'mercado'),
          l('b', 'COMPRA C CARTAO 17 15 MATEUS SUPERM', null),
          l('c', 'COMPRA C CARTAO 17 15 OUTRA LOJA', null),
        ],
        cats,
      ),
    ).toEqual([{ id: 'b', categoryId: 'mercado' }]);
  });

  it('a escolha manual vale mais que as automáticas', () => {
    expect(
      inferirPeloHistorico(
        [
          l('a', 'PADARIA X', 'mercado'),
          l('b', 'PADARIA X', 'mercado'),
          l('c', 'PADARIA X', 'restaurantes', { categoryIsManual: true }),
          l('d', 'COMPRA C CARTAO 08 10 PADARIA X', null),
        ],
        cats,
      ),
    ).toEqual([{ id: 'd', categoryId: 'restaurantes' }]);
  });

  it('não mexe em transferência, em escolha manual nem em categoria apagada', () => {
    expect(
      inferirPeloHistorico(
        [
          l('a', 'LOJA', 'apagada'),
          l('b', 'LOJA', null),
          l('c', 'MERCADO Z', 'mercado'),
          l('d', 'MERCADO Z', null, { isTransfer: true }),
          l('e', 'MERCADO Z', null, { categoryIsManual: true }),
        ],
        cats,
      ),
    ).toEqual([]);
  });
});
