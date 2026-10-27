import { formatBRL, goalStatus, monthPace } from './engine';

describe('goalStatus', () => {
  it.each([
    [0, 90000, 'ok'],
    [71999, 90000, 'ok'],
    [72000, 90000, 'warning'],
    [82800, 90000, 'warning'],
    [89999, 90000, 'warning'],
    [90000, 90000, 'over'],
    [43400, 35000, 'over'],
  ])('gasto %i de %i → %s', (spent, limit, expected) => {
    expect(goalStatus(spent, limit)).toBe(expected);
  });

  it('limite zero com gasto é estouro', () => {
    expect(goalStatus(100, 0)).toBe('over');
    expect(goalStatus(0, 0)).toBe('ok');
  });
});

describe('monthPace', () => {
  it('27 de outubro tem 27/31 do mês', () => {
    expect(monthPace(2026, 10, 27)).toBeCloseTo(27 / 31);
  });
  it('respeita fevereiro bissexto', () => {
    expect(monthPace(2028, 2, 29)).toBe(1);
  });
});

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(311460).replace(/\s/g, ' ')).toBe('R$ 3.114,60');
  });
});

import { budgetRows, daysLeftInMonth, monthTotals } from './engine';

describe('monthTotals', () => {
  const txs = [
    { categoryId: null, amountCents: 635000, isTransfer: false },
    { categoryId: 'mercado', amountCents: -48000, isTransfer: false },
    { categoryId: 'mercado', amountCents: -18642, isTransfer: false },
    { categoryId: null, amountCents: -4200, isTransfer: false },
    { categoryId: null, amountCents: -50000, isTransfer: true },
  ];
  it('soma por categoria, ignora transferência', () => {
    const t = monthTotals(txs);
    expect(t.spentByCategory).toEqual({ mercado: 66642, '': 4200 });
    expect(t.spent).toBe(70842);
    expect(t.income).toBe(635000);
    expect(t.net).toBe(564158);
  });
  it('mês vazio zera tudo', () => {
    expect(monthTotals([])).toEqual({
      spentByCategory: {},
      spent: 0,
      income: 0,
      net: 0,
    });
  });
});

describe('budgetRows', () => {
  it('liga meta, gasto e status', () => {
    const rows = budgetRows(
      [
        { categoryId: 'mercado', limitCents: 90000 },
        { categoryId: 'lazer', limitCents: 35000 },
        { categoryId: 'saude', limitCents: 30000 },
      ],
      { mercado: 82800, lazer: 43400 },
    );
    expect(rows.map((r) => r.status)).toEqual(['warning', 'over', 'ok']);
    expect(rows[2].spentCents).toBe(0);
  });
});

describe('daysLeftInMonth', () => {
  it('27 de outubro → 4 dias', () =>
    expect(daysLeftInMonth(2026, 10, 27)).toBe(4));
  it('último dia → 0', () => expect(daysLeftInMonth(2026, 10, 31)).toBe(0));
});
