import {
  montarRecorrencias,
  porGrupo,
  totalMensal,
  type TxRec,
} from './linhas';

const tx = (
  date: string,
  amountCents: number,
  description: string,
  categoryId: string | null = null,
): TxRec => ({
  date,
  amountCents,
  description,
  descriptionNorm: description.toUpperCase(),
  categoryId,
  isTransfer: false,
});

const txs = [
  tx('2026-08-24', -3990, 'Netflix', 'assinaturas'),
  tx('2026-09-24', -3990, 'Netflix', 'assinaturas'),
  tx('2026-10-24', -4490, 'Netflix', 'assinaturas'),
  tx('2026-08-05', -66124, 'Aluguel', 'moradia'),
  tx('2026-09-05', -66124, 'Aluguel', 'moradia'),
  tx('2026-10-05', -66124, 'Aluguel', 'moradia'),
  tx('2026-08-05', 635000, 'Salário'),
  tx('2026-09-05', 635000, 'Salário'),
  tx('2026-10-05', 635000, 'Salário'),
  tx('2026-10-12', -2000, 'Padaria'),
];

describe('montarRecorrencias', () => {
  const linhas = montarRecorrencias(txs, '2026-10-27');

  it('detecta gastos e entradas, ignorando compras avulsas', () => {
    expect(linhas.map((l) => `${l.tipo}:${l.nome}`).sort()).toEqual([
      'entrada:Salário',
      'gasto:Aluguel',
      'gasto:Netflix',
    ]);
  });

  it('ordena pela próxima data', () => {
    expect(linhas.map((l) => l.proxima)).toEqual([
      '2026-11-05',
      '2026-11-05',
      '2026-11-24',
    ]);
    expect(linhas.at(-1)?.nome).toBe('Netflix');
  });

  it('marca reajuste com a variação', () => {
    const n = linhas.find((l) => l.nome === 'Netflix')!;
    expect(n).toMatchObject({
      reajustada: true,
      pct: 12.5,
      previousCents: 3990,
    });
    expect(linhas.find((l) => l.nome === 'Aluguel')?.reajustada).toBe(false);
  });

  it('soma o total mensal por tipo', () => {
    expect(totalMensal(linhas, 'gasto')).toBe(66124 + 4490);
    expect(totalMensal(linhas, 'entrada')).toBe(635000);
  });

  it('separa assinaturas, contas fixas e entradas', () => {
    const grupos = porGrupo(linhas).map((g) => [
      g.grupo,
      g.linhas.map((l) => l.nome),
      g.total,
    ]);
    expect(grupos).toEqual([
      ['assinaturas', ['Netflix'], 4490],
      ['contas', ['Aluguel'], 66124],
      ['entradas', ['Salário'], 635000],
    ]);
  });
});

describe('parcelamentos', () => {
  const parc = (date: string, n: number, total = 6, cents = -15000) => ({
    ...tx(date, cents, 'LOJA X PARC', 'compras'),
    accountId: 'cartao',
    installment: { n, total },
  });

  it('mostra a parcela atual, quantas faltam e quando termina, fora das contas fixas', () => {
    const l = montarRecorrencias(
      [parc('2026-08-10', 2), parc('2026-09-10', 3), parc('2026-10-10', 4)],
      '2026-10-27',
    );
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({
      grupo: 'parcelamentos',
      cents: 15000,
      proxima: '2026-11-10',
      parcela: { n: 4, total: 6, faltam: 2, termina: '2026-12' },
    });
  });

  it('some quando a última foi paga ou quando parou de aparecer', () => {
    expect(montarRecorrencias([parc('2026-10-10', 6)], '2026-10-27')).toEqual(
      [],
    );
    expect(montarRecorrencias([parc('2026-07-10', 2)], '2026-10-27')).toEqual(
      [],
    );
  });
});
