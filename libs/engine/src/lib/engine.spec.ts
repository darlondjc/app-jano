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
