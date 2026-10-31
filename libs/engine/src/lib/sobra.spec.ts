import { limitesComSobra } from './engine';

describe('limitesComSobra', () => {
  const metas = [
    { categoryId: 'mercado', limitCents: 90000, rollover: true },
    { categoryId: 'lazer', limitCents: 30000, rollover: true },
    { categoryId: 'transporte', limitCents: 20000 },
  ];

  it('soma ao limite o que sobrou no mês anterior, só nas metas com rollover', () => {
    const r = limitesComSobra(metas, {
      mercado: 70000,
      lazer: 45000,
      transporte: 0,
    });
    expect(r.map((b) => [b.categoryId, b.limitCents, b.sobraCents])).toEqual([
      ['mercado', 110000, 20000],
      ['lazer', 30000, 0],
      ['transporte', 20000, 0],
    ]);
  });

  it('mês anterior com dados mas sem gasto na categoria: sobra o limite inteiro', () => {
    expect(limitesComSobra([metas[0]], {})[0].sobraCents).toBe(90000);
  });

  it('mês anterior sem dados: nenhuma folga', () => {
    expect(limitesComSobra(metas, null).map((b) => b.sobraCents)).toEqual([
      0, 0, 0,
    ]);
  });
});
