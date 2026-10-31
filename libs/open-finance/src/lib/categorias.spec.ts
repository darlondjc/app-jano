import { addDedupeKeys } from '@jano/import-file';
import { categorizar, reaplicarRegras } from './categorizar';
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

  it('reaplica as regras no histórico, sem tocar no manual, dividido ou transferência', () => {
    const t = (id: string, over: object = {}) => ({
      id,
      descriptionNorm: 'COMPRA MATEUS SUPERMERCADOS',
      categoryId: 'compras',
      categoryIsManual: false,
      isTransfer: false,
      ...over,
    });
    const r = reaplicarRegras(
      [
        t('auto'),
        t('ja-certo', { categoryId: 'mercado' }),
        t('sem-cat', { categoryId: null }),
        t('manual', { categoryIsManual: true }),
        t('dividido', { splits: [{}, {}] }),
        t('transf', { isTransfer: true }),
        t('outra-loja', { descriptionNorm: 'PADARIA' }),
      ],
      [{ pattern: 'MATEUS', categoryId: 'mercado' }],
      [
        { id: 'mercado', name: 'Mercado' },
        { id: 'compras', name: 'Compras' },
      ],
    );
    expect(r).toEqual([
      { id: 'auto', categoryId: 'mercado' },
      { id: 'sem-cat', categoryId: 'mercado' },
    ]);
  });

  it('regra para categoria apagada não vale', () => {
    expect(
      reaplicarRegras(
        [
          {
            id: 'x',
            descriptionNorm: 'MATEUS',
            categoryId: null,
            categoryIsManual: false,
            isTransfer: false,
          },
        ],
        [{ pattern: 'MATEUS', categoryId: 'apagada' }],
        [{ id: 'mercado', name: 'Mercado' }],
      ),
    ).toEqual([]);
  });
});
