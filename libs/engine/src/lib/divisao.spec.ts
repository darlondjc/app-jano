import { monthTotals, partes, validarDivisao } from './engine';
import { categoriesAboveNormal } from './insights';

const tx = {
  categoryId: 'mercado',
  amountCents: -48000,
  isTransfer: false,
  splits: [
    { categoryId: 'mercado', amountCents: -42000 },
    { categoryId: 'restaurantes', amountCents: -6000 },
  ],
};

describe('divisão de lançamento', () => {
  it('partes: a divisão ou o lançamento inteiro', () => {
    expect(partes(tx)).toHaveLength(2);
    expect(partes({ categoryId: 'x', amountCents: -100 })).toEqual([
      { categoryId: 'x', amountCents: -100 },
    ]);
  });

  it('monthTotals conta cada categoria pela sua parte, sem mudar o total', () => {
    const r = monthTotals([tx]);
    expect(r.spent).toBe(48000);
    expect(r.spentByCategory).toEqual({ mercado: 42000, restaurantes: 6000 });
  });

  it('insights enxergam a parte de cada categoria', () => {
    const hist = (date: string, cents: number) => ({
      date,
      amountCents: cents,
      categoryId: 'restaurantes',
      descriptionNorm: 'X',
      isTransfer: false,
    });
    const r = categoriesAboveNormal(
      [
        hist('2026-08-10', -10000),
        hist('2026-09-10', -10000),
        {
          ...tx,
          date: '2026-10-05',
          descriptionNorm: 'ATACADAO',
          splits: [
            { categoryId: 'mercado', amountCents: -28000 },
            { categoryId: 'restaurantes', amountCents: -20000 },
          ],
        },
      ],
      '2026-10',
    );
    expect(r.map((x) => [x.categoryId, x.spentCents])).toEqual([
      ['restaurantes', 20000],
    ]);
  });

  it.each([
    [
      10000,
      [
        { categoryId: 'a', amountCents: 5000 },
        { categoryId: 'b', amountCents: 5000 },
      ],
      'Só dá para dividir uma saída.',
    ],
    [
      -10000,
      [{ categoryId: 'a', amountCents: -10000 }],
      'Divida em pelo menos duas categorias.',
    ],
    [
      -10000,
      [
        { categoryId: 'a', amountCents: -5000 },
        { categoryId: null, amountCents: -5000 },
      ],
      'Escolha a categoria de cada parte.',
    ],
    [
      -10000,
      [
        { categoryId: 'a', amountCents: -5000 },
        { categoryId: 'a', amountCents: -5000 },
      ],
      'Cada categoria aparece uma vez só.',
    ],
    [
      -10000,
      [
        { categoryId: 'a', amountCents: -10000 },
        { categoryId: 'b', amountCents: 0 },
      ],
      'Cada parte precisa ter um valor.',
    ],
  ])('recusa: %i %j', (total, divisao, motivo) => {
    expect(validarDivisao(total, divisao)).toEqual({ ok: false, motivo });
  });

  it('diz quanto falta ou quanto passou', () => {
    expect(
      validarDivisao(-10000, [
        { categoryId: 'a', amountCents: -4000 },
        { categoryId: 'b', amountCents: -5000 },
      ]),
    ).toEqual({
      ok: false,
      motivo: 'Falta distribuir uma parte.',
      faltaCents: 1000,
    });
    expect(
      validarDivisao(-10000, [
        { categoryId: 'a', amountCents: -6000 },
        { categoryId: 'b', amountCents: -5000 },
      ]),
    ).toEqual({
      ok: false,
      motivo: 'As partes passam do total.',
      faltaCents: -1000,
    });
    expect(
      validarDivisao(-10000, [
        { categoryId: 'a', amountCents: -6000 },
        { categoryId: 'b', amountCents: -4000 },
      ]),
    ).toEqual({ ok: true });
  });
});
