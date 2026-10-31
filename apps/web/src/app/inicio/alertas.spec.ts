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

  it('dispensado sai e os ids não dependem dos números', () => {
    const entrada = {
      ...base,
      budgets: [
        { categoryId: 'mercado', limitCents: 90000 },
        { categoryId: 'lazer', limitCents: 35000 },
      ],
      spentByCategory: { mercado: 82800, lazer: 43400 },
    };
    expect(montarAlertas(entrada).map((a) => a.id)).toEqual([
      'meta-passou:lazer',
      'meta-perto:mercado',
    ]);
    const r = montarAlertas({
      ...entrada,
      spentByCategory: { mercado: 85000, lazer: 43400 },
      dispensados: new Set(['meta-passou:lazer']),
    });
    expect(r.map((a) => a.titulo)).toEqual(['MERCADO está em 94% da meta']);
  });

  it('gasto fora do padrão leva direto à transação, com o nome sem o prefixo do PIX', () => {
    const tx = (date: string, reais: number, extra = {}) => ({
      date,
      amountCents: -reais * 100,
      categoryId: 'moradia',
      descriptionNorm: 'X',
      isTransfer: false,
      ...extra,
    });
    const historico = [3, 4, 5, 6, 7, 8].map((m) =>
      tx(`2026-0${m}-10`, 10 + m),
    );
    const r = montarAlertas({
      ...base,
      txs: [
        ...historico,
        tx('2026-10-09', 3460, {
          id: 'abc',
          description: 'PIX - ENVIADO 09/10 11:59 JULIO BEZERRA',
          descriptionNorm: 'PIX ENVIADO 11 59 JULIO BEZERRA',
        }),
      ],
    });
    const incomum = r.find((a) => a.id.startsWith('incomum:'));
    expect(incomum?.titulo).toBe('Gasto fora do padrão: JULIO BEZERRA');
    expect(incomum?.acao).toEqual({
      rotulo: 'Ver transação',
      rota: '/transacoes',
      queryParams: { tx: 'abc' },
    });
  });
});
