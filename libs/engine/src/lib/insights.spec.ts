import {
  categoriesAboveNormal,
  detectRecurrences,
  goalStreaks,
  monthScore,
  newSubscriptions,
  previousMonths,
  projectMonthEnd,
  repricedRecurrences,
  unusualTransactions,
  type HistTx,
} from './insights';

const tx = (
  date: string,
  reais: number,
  categoryId: string | null,
  descriptionNorm = 'X',
  isTransfer = false,
): HistTx => ({
  date,
  amountCents: Math.round(-reais * 100),
  categoryId,
  descriptionNorm,
  isTransfer,
});

describe('previousMonths', () => {
  it('volta virando o ano', () => {
    expect(previousMonths('2026-02', 3)).toEqual([
      '2026-01',
      '2025-12',
      '2025-11',
    ]);
  });
});

describe('categoriesAboveNormal', () => {
  const hist = [
    tx('2026-07-10', 300, 'lazer'),
    tx('2026-08-10', 280, 'lazer'),
    tx('2026-09-10', 320, 'lazer'),
    tx('2026-07-12', 800, 'mercado'),
    tx('2026-08-12', 820, 'mercado'),
    tx('2026-09-12', 810, 'mercado'),
  ];
  it('Lazer 434 contra média 300 (+45%) é avisado; Mercado normal não', () => {
    const r = categoriesAboveNormal(
      [
        ...hist,
        tx('2026-10-20', 434, 'lazer'),
        tx('2026-10-21', 400, 'mercado'),
      ],
      '2026-10',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      kind: 'categoria-acima',
      categoryId: 'lazer',
      avgCents: 30000,
      spentCents: 43400,
      pct: 45,
    });
  });
  it('diferença abaixo de R$ 50 não avisa', () => {
    const r = categoriesAboveNormal(
      [...hist, tx('2026-10-20', 340, 'lazer')],
      '2026-10',
    );
    expect(r).toEqual([]);
  });
  it('com menos de 2 meses de histórico não avisa', () => {
    expect(
      categoriesAboveNormal(
        [tx('2026-09-10', 100, 'lazer'), tx('2026-10-10', 900, 'lazer')],
        '2026-10',
      ),
    ).toEqual([]);
  });
  it('transferência não entra', () => {
    expect(
      categoriesAboveNormal(
        [...hist, tx('2026-10-20', 900, 'lazer', 'X', true)],
        '2026-10',
      ),
    ).toEqual([]);
  });
});

describe('unusualTransactions', () => {
  const base = [100, 110, 90, 105, 95, 100].map((v, i) =>
    tx(`2026-0${i + 3}-10`, v, 'mercado'),
  );
  it('R$ 480 contra compras de ~R$ 100 é incomum (4,8x)', () => {
    const r = unusualTransactions(
      [...base, tx('2026-10-22', 480, 'mercado', 'ATACADAO')],
      '2026-10',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      kind: 'gasto-incomum',
      description: 'ATACADAO',
      amountCents: 48000,
      times: 4.8,
    });
  });
  it('compra comum não é', () => {
    expect(
      unusualTransactions(
        [...base, tx('2026-10-22', 130, 'mercado')],
        '2026-10',
      ),
    ).toEqual([]);
  });
  it('exige 5 compras de histórico', () => {
    expect(
      unusualTransactions(
        [...base.slice(0, 4), tx('2026-10-22', 480, 'mercado')],
        '2026-10',
      ),
    ).toEqual([]);
  });
});

describe('detectRecurrences e reajuste', () => {
  const netflix = [
    tx('2026-07-24', 39.9, 'assinaturas', 'NETFLIX'),
    tx('2026-08-24', 39.9, 'assinaturas', 'NETFLIX'),
    tx('2026-09-24', 39.9, 'assinaturas', 'NETFLIX'),
    tx('2026-10-24', 44.9, 'assinaturas', 'NETFLIX'),
  ];
  const aleatorio = [
    tx('2026-07-03', 50, 'mercado', 'MERCADO'),
    tx('2026-08-20', 150, 'mercado', 'MERCADO'),
    tx('2026-09-11', 70, 'mercado', 'MERCADO'),
  ];

  it('acha a assinatura e ignora compra irregular', () => {
    const r = detectRecurrences([...netflix, ...aleatorio]);
    expect(r.map((s) => s.description)).toEqual(['NETFLIX']);
    expect(r[0]).toMatchObject({
      amountCents: 4490,
      previousCents: 3990,
      day: 24,
      months: 4,
    });
  });
  it('avisa o reajuste de 12,5%', () => {
    const r = repricedRecurrences(detectRecurrences(netflix));
    expect(r[0]).toMatchObject({
      kind: 'recorrencia-reajustada',
      fromCents: 3990,
      toCents: 4490,
      pct: 12.5,
    });
  });
  it('valor estável não gera reajuste', () => {
    expect(repricedRecurrences(detectRecurrences(netflix.slice(0, 3)))).toEqual(
      [],
    );
  });
});

describe('newSubscriptions', () => {
  const txs = [
    tx('2026-05-10', 21.9, 'assinaturas', 'SPOTIFY'),
    tx('2026-10-15', 29.9, 'assinaturas', 'MAX'),
    tx('2026-10-16', 29.9, 'assinaturas', 'MAX'),
  ];
  it('só quem apareceu nos últimos 30 dias', () => {
    const r = newSubscriptions(txs, 'assinaturas', '2026-10-27');
    expect(r).toEqual([
      {
        kind: 'nova-assinatura',
        description: 'MAX',
        amountCents: 2990,
        firstSeen: '2026-10-15',
      },
    ]);
  });
});

describe('goalStreaks', () => {
  const txs = [
    tx('2026-07-10', 380, 'mercado'),
    tx('2026-08-10', 390, 'mercado'),
    tx('2026-09-10', 395, 'mercado'),
    tx('2026-06-10', 500, 'mercado'),
  ];
  it('conta meses seguidos dentro da meta', () => {
    const r = goalStreaks(
      txs,
      [{ categoryId: 'mercado', limitCents: 40000 }],
      '2026-10',
    );
    expect(r).toEqual([
      { kind: 'sequencia-metas', categoryId: 'mercado', months: 3 },
    ]);
  });
  it('um mês só não é sequência', () => {
    expect(
      goalStreaks(
        [tx('2026-09-10', 100, 'mercado')],
        [{ categoryId: 'mercado', limitCents: 40000 }],
        '2026-10',
      ),
    ).toEqual([]);
  });
});

describe('projectMonthEnd', () => {
  it('projeta pelo ritmo', () =>
    expect(projectMonthEnd(311460, 27 / 31)).toBe(357602));
  it('mês encerrado não muda', () =>
    expect(projectMonthEnd(1000, 1)).toBe(1000));
});

describe('monthScore', () => {
  const base = {
    pace: 0.5,
    incomeCents: 650000,
    projectedNetCents: 130000,
    pastMonthlySpends: [300000, 300000, 300000],
  };

  it('tudo ótimo = 100', () => {
    const r = monthScore({
      ...base,
      goals: [{ spentCents: 10000, limitCents: 50000 }],
    });
    expect(r.score).toBe(100);
  });
  it('metas estouradas e sem sobra derrubam a nota', () => {
    const r = monthScore({
      ...base,
      projectedNetCents: -1000,
      goals: [{ spentCents: 60000, limitCents: 50000 }],
    });
    expect(r.parts.find((p) => p.name === 'metas-no-ritmo')?.points).toBe(0);
    expect(r.parts.find((p) => p.name === 'sobra-projetada')?.points).toBe(0);
    expect(r.score).toBe(30);
  });
  it('sem histórico a estabilidade sai da conta e a nota é reescalada', () => {
    const r = monthScore({
      ...base,
      pastMonthlySpends: [],
      goals: [{ spentCents: 10000, limitCents: 50000 }],
    });
    expect(r.parts.map((p) => p.name)).toEqual([
      'metas-no-ritmo',
      'sobra-projetada',
    ]);
    expect(r.score).toBe(100);
  });
  it('sem nenhum dado a nota é 0', () => {
    expect(
      monthScore({
        goals: [],
        pace: 0.5,
        incomeCents: 0,
        projectedNetCents: 0,
        pastMonthlySpends: [],
      }).score,
    ).toBe(0);
  });
});

describe('detectRecurrences de entradas', () => {
  const sal = (date: string, cents: number) => ({
    date,
    amountCents: cents,
    categoryId: null,
    descriptionNorm: 'SALARIO EMPRESA',
    isTransfer: false,
  });
  const txs = [
    sal('2026-08-05', 630000),
    sal('2026-09-05', 635000),
    sal('2026-10-05', 635000),
  ];
  it('detecta salário mensal e não conta como gasto', () => {
    expect(detectRecurrences(txs)).toEqual([]);
    const [r] = detectRecurrences(txs, 'entrada');
    expect(r).toMatchObject({
      description: 'SALARIO EMPRESA',
      amountCents: 635000,
      day: 5,
      months: 3,
    });
  });
});
