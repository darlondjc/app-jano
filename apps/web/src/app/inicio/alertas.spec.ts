import { describe, expect, it } from 'vitest';
import { montarAlertas, type EntradaAlertas } from './alertas';

const base: EntradaAlertas = {
  txs: [],
  month: '2026-10',
  today: '2026-10-27',
  budgets: [],
  spentByCategory: {},
  daysLeft: 4,
  assinaturasId: 'assinaturas',
  nomeCategoria: (id) => id.toUpperCase(),
  moeda: (c) => `R$ ${(c / 100).toFixed(2)}`,
};

describe('montarAlertas', () => {
  it('sem dados não há alertas', () => expect(montarAlertas(base)).toEqual([]));

  it('meta perto do limite e acima do limite', () => {
    const r = montarAlertas({
      ...base,
      budgets: [
        { categoryId: 'mercado', limitCents: 90000 },
        { categoryId: 'lazer', limitCents: 35000 },
        { categoryId: 'casa', limitCents: 100000 },
      ],
      spentByCategory: { mercado: 82800, lazer: 43400, casa: 10000 },
    });
    expect(r.map((a) => a.titulo)).toEqual([
      'LAZER passou da meta (124%)',
      'MERCADO está em 92% da meta',
    ]);
    expect(r[1].texto).toContain('faltando 4 dias');
  });

  it('limita a quatro alertas', () => {
    const budgets = ['a', 'b', 'c'].map((categoryId) => ({
      categoryId,
      limitCents: 100,
    }));
    const r = montarAlertas({
      ...base,
      budgets,
      spentByCategory: { a: 100, b: 100, c: 100 },
    });
    expect(r.length).toBeLessThanOrEqual(4);
    expect(r).toHaveLength(2);
  });
});
