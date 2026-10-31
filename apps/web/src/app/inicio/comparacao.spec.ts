import { describe, expect, it } from 'vitest';
import { comparacaoNoDia, variacao } from './comparacao';

const tx = (date: string, reais: number) => ({
  date,
  amountCents: Math.round(reais * 100),
  categoryId: null,
  isTransfer: false,
});

describe('comparacaoNoDia', () => {
  it('soma cada mês só até o mesmo dia', () => {
    const r = comparacaoNoDia(
      [
        tx('2026-09-05', -100),
        tx('2026-09-20', -900), // depois do dia 12: fora
        tx('2026-09-06', 5000),
        tx('2026-10-03', -150),
        tx('2026-10-10', 5000),
      ],
      '2026-10',
      12,
      1,
    );
    expect(r.gastos).toEqual([10000, 15000]);
    expect(r.receitas).toEqual([500000, 500000]);
  });
});

describe('variacao', () => {
  it('gasto subindo é ruim, receita subindo é boa', () => {
    expect(variacao([10000, 11200], '2026-09', false)).toEqual({
      texto: '+12% que set',
      tom: 'bad',
    });
    expect(variacao([10000, 11200], '2026-09', true)?.tom).toBe('good');
  });
  it('diferença pequena conta como igual; sem base, sem selo', () => {
    expect(variacao([10000, 10200], '2026-09', false)).toEqual({
      texto: 'igual a set',
      tom: 'neutral',
    });
    expect(variacao([0, 5000], '2026-09', false)).toBeNull();
  });
});
