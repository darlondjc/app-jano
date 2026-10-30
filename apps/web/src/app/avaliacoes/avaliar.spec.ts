import {
  compararComAnterior,
  distribuicao,
  explicarNota,
  fraseResumo,
  maioresEstabelecimentos,
  serieMensal,
  ultimosMeses,
  type TxAval,
} from './avaliar';

const tx = (
  date: string,
  amountCents: number,
  categoryId: string | null = 'mercado',
  description = 'LOJA',
): TxAval => ({
  date,
  amountCents,
  categoryId,
  description,
  descriptionNorm: description.toUpperCase(),
  isTransfer: false,
  accountId: 'cc',
});

describe('avaliar', () => {
  it('lista os últimos meses, do mais antigo ao atual', () => {
    expect(ultimosMeses('2026-02', 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('compara com o mesmo trecho do mês anterior', () => {
    const txs = [
      tx('2026-09-05', -10000),
      tx('2026-09-25', -50000), // depois do dia 10: fora da comparação
      tx('2026-10-04', -9200),
    ];
    const c = compararComAnterior(txs, '2026-10', 10);
    expect(c).toEqual({ atual: 9200, anterior: 10000, pct: -8 });
  });

  it('sem mês anterior não há percentual', () => {
    expect(
      compararComAnterior([tx('2026-10-04', -100)], '2026-10', 10).pct,
    ).toBeNull();
  });

  it('monta a frase do resumo', () => {
    const c = { atual: 92, anterior: 100, pct: -8 };
    expect(fraseResumo(c, '2026-10', { nome: 'Lazer', pct: 24 })).toBe(
      'Você gastou 8% menos que em setembro, mas Lazer subiu 24%.',
    );
    expect(fraseResumo({ ...c, pct: 12 }, '2026-01', null)).toBe(
      'Você gastou 12% mais que em dezembro.',
    );
    expect(fraseResumo({ ...c, pct: null }, '2026-10', null)).toContain(
      'Ainda não há',
    );
  });

  it('série mensal pega as categorias de maior gasto', () => {
    const txs = [
      tx('2026-09-01', -300, 'a'),
      tx('2026-10-01', -500, 'a'),
      tx('2026-10-02', -100, 'b'),
      tx('2026-10-03', -50, 'c'),
    ];
    const s = serieMensal(txs, ['2026-09', '2026-10'], undefined, 2);
    expect(s).toEqual([
      { categoryId: 'a', valores: [300, 500] },
      { categoryId: 'b', valores: [0, 100] },
    ]);
  });

  it('distribuição junta o resto em Outras e soma ~100%', () => {
    const d = distribuicao({ a: 500, b: 300, c: 100, d: 60, e: 30, f: 10 }, 3);
    expect(d.map((f) => f.categoryId)).toEqual(['a', 'b', 'c', null]);
    expect(d.at(-1)?.cents).toBe(100);
    expect(distribuicao({})).toEqual([]);
  });

  it('maiores estabelecimentos agrupam pelo nome e ignoram entradas', () => {
    const txs = [
      tx('2026-10-01', -1000, 'mercado', 'Atacadão'),
      tx('2026-10-09', -500, 'mercado', 'Atacadão'),
      tx('2026-10-02', -700, 'lazer', 'Cinema'),
      tx('2026-10-03', 9000, null, 'Salário'),
    ];
    expect(maioresEstabelecimentos(txs, '2026-10', 2)).toEqual([
      { nome: 'Atacadão', cents: 1500, compras: 2, categoryId: 'mercado' },
      { nome: 'Cinema', cents: 700, compras: 1, categoryId: 'lazer' },
    ]);
  });

  it('explica a nota por parte', () => {
    expect(
      explicarNota([{ name: 'metas-no-ritmo', points: 26.7, max: 40 }]),
    ).toEqual(['Metas no ritmo: 27 de 40 pontos']);
  });
});
