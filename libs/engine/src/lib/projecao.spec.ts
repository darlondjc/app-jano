import { projetar, proximaCobranca, type TxProjecao } from './projecao';

const tx = (
  date: string,
  amountCents: number,
  categoryId: string | null = 'mercado',
): TxProjecao => ({ date, amountCents, categoryId, isTransfer: false });

/** Três meses fechados: receita 10000, gasto 6000 (4000 mercado + 2000 lazer). */
const historico = ['2026-07', '2026-08', '2026-09'].flatMap((m) => [
  tx(`${m}-05`, 10000, null),
  tx(`${m}-10`, -4000, 'mercado'),
  tx(`${m}-20`, -2000, 'lazer'),
]);

const base = {
  txs: historico,
  month: '2026-10',
  dia: 15,
  diasNoMes: 31,
  horizonte: 3,
  saldoInicial: 50000,
};

describe('projetar', () => {
  it('sem histórico suficiente não projeta', () => {
    expect(projetar({ ...base, txs: historico.slice(0, 3) })).toBeNull();
  });

  it('soma a sobra mensal média a cada mês', () => {
    const r = projetar(base)!;
    expect(r.receitaMedia).toBe(10000);
    expect(r.gastoMedio).toBe(6000);
    // Outubro sem lançamentos: resta receber 10000 e gastar 6000 → +4000.
    expect(r.pontos[0].base).toBe(54000);
    expect(r.pontos.map((p) => p.base)).toEqual([54000, 58000, 62000, 66000]);
    expect(r.pontos.map((p) => p.mes)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('o mês atual só completa o que falta da média', () => {
    const r = projetar({
      ...base,
      txs: [
        ...historico,
        tx('2026-10-05', 10000, null),
        tx('2026-10-08', -1000),
      ],
    })!;
    // Já entrou 10000 e saiu 1000: faltam 5000 de gasto.
    expect(r.pontos[0].base).toBe(50000 + 0 - 5000);
  });

  it('aplica cenários sem mexer na base', () => {
    const r = projetar({
      ...base,
      cenarios: [
        { tipo: 'cortar', categoryId: 'lazer', pct: 20 },
        { tipo: 'parcela', cents: 400 },
        { tipo: 'renda', cents: 800, mesesAFrente: 2 },
      ],
    })!;
    // Por mês: +400 (20% de 2000) −400 (parcela); renda +800 no mês 2.
    expect(r.pontos[3].base).toBe(66000);
    expect(r.pontos[3].cenario).toBe(66000 + 800);
    expect(r.efeitos).toEqual([1200, -1200, 800]);
  });

  it('faixa de incerteza cresce com o tempo e é zero com sobras iguais', () => {
    const r = projetar(base)!;
    expect(r.desvio).toBe(0);
    const variavel = projetar({
      ...base,
      txs: [...historico, tx('2026-09-25', -3000)],
    })!;
    const larguras = variavel.pontos.map((p) => p.otimista - p.pessimista);
    expect(larguras[3]).toBeGreaterThan(larguras[1]);
  });

  it('reconstrói o saldo dos meses anteriores', () => {
    const r = projetar(base)!;
    // Outubro ainda sem lançamentos: saldo no fim de setembro = saldo de hoje.
    expect(r.realizado.at(-1)).toEqual({ mes: '2026-09', valor: 50000 });
    expect(r.realizado[1]).toEqual({ mes: '2026-08', valor: 46000 });
  });
});

describe('proximaCobranca', () => {
  it('fica no mês se o dia ainda não passou', () => {
    expect(proximaCobranca(24, '2026-10-20')).toBe('2026-10-24');
    expect(proximaCobranca(20, '2026-10-20')).toBe('2026-10-20');
  });
  it('vai para o mês seguinte e ajusta fim de mês', () => {
    expect(proximaCobranca(5, '2026-10-20')).toBe('2026-11-05');
    expect(proximaCobranca(5, '2026-12-20')).toBe('2027-01-05');
    expect(proximaCobranca(31, '2026-02-10')).toBe('2026-02-28');
  });
});
