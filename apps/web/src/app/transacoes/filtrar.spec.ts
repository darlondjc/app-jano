import {
  filtrar,
  SEM_FILTROS,
  totalDeFiltros,
  totalizar,
  type Filtros,
} from './filtrar';

const base = {
  accountId: 'conta',
  descriptionNorm: '',
  isTransfer: false,
};
const txs = [
  {
    ...base,
    description: 'Pão de Açúcar',
    amountCents: -18642,
    categoryId: 'mercado',
  },
  {
    ...base,
    description: 'Uber',
    amountCents: -2370,
    categoryId: 'transporte',
    accountId: 'cartao',
  },
  { ...base, description: 'Salário', amountCents: 635000, categoryId: null },
  {
    ...base,
    description: 'Pagamento de fatura',
    amountCents: -100000,
    categoryId: null,
    isTransfer: true,
  },
];
const nome = (id: string | null) =>
  id === 'mercado' ? 'Mercado' : (id ?? 'Sem categoria');
const com = (p: Partial<Filtros>) =>
  filtrar(txs, { ...SEM_FILTROS, ...p }, nome).map((t) => t.description);

describe('filtrar', () => {
  it('sem filtros devolve tudo', () => expect(com({})).toHaveLength(4));
  it('tipo gastos exclui transferência e receita', () =>
    expect(com({ tipo: 'gastos' })).toEqual(['Pão de Açúcar', 'Uber']));
  it('tipo receitas e transferências', () => {
    expect(com({ tipo: 'receitas' })).toEqual(['Salário']);
    expect(com({ tipo: 'transferencias' })).toEqual(['Pagamento de fatura']);
  });
  it('categorias, incluindo sem categoria', () => {
    expect(com({ categorias: ['mercado'] })).toEqual(['Pão de Açúcar']);
    expect(com({ categorias: [''] })).toEqual([
      'Salário',
      'Pagamento de fatura',
    ]);
  });
  it('só sem categoria ignora transferências', () =>
    expect(com({ semCategoria: true })).toEqual(['Salário']));
  it('conta', () => expect(com({ conta: 'cartao' })).toEqual(['Uber']));
  it('busca ignora acento e caixa', () =>
    expect(com({ busca: 'pao de acucar' })).toEqual(['Pão de Açúcar']));
  it('busca por nome da categoria', () =>
    expect(com({ busca: 'mercado' })).toEqual(['Pão de Açúcar']));
  it('busca por valor', () => {
    expect(com({ busca: '186' })).toEqual(['Pão de Açúcar']);
    expect(com({ busca: '23,70' })).toEqual(['Uber']);
  });
  it('conta quantos filtros estão ativos', () =>
    expect(totalDeFiltros({ ...SEM_FILTROS, tipo: 'gastos', conta: 'x' })).toBe(
      2,
    ));
});

describe('filtrar com estorno de cartão', () => {
  const lista = [
    {
      accountId: 'c',
      description: 'Loja',
      descriptionNorm: 'LOJA',
      amountCents: -1000,
      categoryId: null,
      isTransfer: false,
    },
    {
      accountId: 'c',
      description: 'Estorno',
      descriptionNorm: 'ESTORNO',
      amountCents: 500,
      categoryId: null,
      isTransfer: false,
    },
    {
      accountId: 'cc',
      description: 'Salário',
      descriptionNorm: 'SALARIO',
      amountCents: 9000,
      categoryId: null,
      isTransfer: false,
    },
  ];
  const cartoes = new Set(['c']);
  const nome = () => '';
  it('estorno aparece em gastos e não em receitas', () => {
    expect(
      filtrar(lista, { ...SEM_FILTROS, tipo: 'gastos' }, nome, cartoes).map(
        (t) => t.description,
      ),
    ).toEqual(['Loja', 'Estorno']);
    expect(
      filtrar(lista, { ...SEM_FILTROS, tipo: 'receitas' }, nome, cartoes).map(
        (t) => t.description,
      ),
    ).toEqual(['Salário']);
  });
});

describe('totalizar', () => {
  it('soma gastos e entradas, sem transferências', () => {
    expect(totalizar(txs, SEM_FILTROS)).toEqual({
      n: 4,
      gastosCents: 18642 + 2370,
      entradasCents: 635000,
      transferidoCents: 100000,
    });
  });
  it('estorno no cartão abate do gasto', () => {
    const estorno = { ...txs[1], amountCents: 500 };
    expect(
      totalizar([txs[1], estorno], SEM_FILTROS, new Set(['cartao']))
        .gastosCents,
    ).toBe(1870);
  });
  it('com filtro de categoria, conta só as partes dela', () => {
    const dividida = {
      ...base,
      description: 'Atacadão',
      amountCents: -10000,
      categoryId: 'mercado',
      splits: [
        { categoryId: 'mercado', amountCents: -7000 },
        { categoryId: 'casa', amountCents: -3000 },
      ],
    };
    const f = { ...SEM_FILTROS, categorias: ['mercado'] };
    expect(totalizar([txs[0], dividida], f).gastosCents).toBe(18642 + 7000);
  });
});
