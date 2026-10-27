import { suggestCategory, DEFAULT_RULES } from './categorize';
import { addDedupeKeys } from './dedupe';
import { planImport } from './plan';

const rows = addDedupeKeys('cc', [
  {
    date: '2026-10-22',
    amountCents: -48000,
    description: 'ATACADAO',
    externalId: 'A',
  },
  {
    date: '2026-10-05',
    amountCents: 635000,
    description: 'SALARIO',
    externalId: 'B',
  },
  {
    date: '2026-10-21',
    amountCents: -4200,
    description: 'PIX MERCADINHO SOUZA',
  },
]);

describe('planImport', () => {
  it('separa novas e duplicadas e informa o período', () => {
    const plan = planImport(rows, new Set(['f:cc:A']));
    expect(plan.fresh).toHaveLength(2);
    expect(plan.duplicates.map((d) => d.externalId)).toEqual(['A']);
    expect(plan).toMatchObject({ from: '2026-10-05', to: '2026-10-22' });
  });
  it('segunda importação do mesmo arquivo não tem nada novo', () => {
    const plan = planImport(rows, new Set(rows.map((r) => r.dedupeKey)));
    expect(plan.fresh).toHaveLength(0);
  });
  it('arquivo vazio não quebra', () => {
    expect(planImport([], new Set())).toEqual({
      fresh: [],
      duplicates: [],
      from: null,
      to: null,
    });
  });
});

describe('suggestCategory', () => {
  it('usa o dicionário padrão', () => {
    expect(suggestCategory('ATACADAO 22', DEFAULT_RULES)).toBe('Mercado');
    expect(suggestCategory('POSTO IPIRANGA', DEFAULT_RULES)).toBe('Transporte');
  });
  it('regra do usuário com prioridade vence o dicionário', () => {
    const rules = [
      ...DEFAULT_RULES,
      { pattern: 'ATACADAO', categoryName: 'Casa', priority: 10 },
    ];
    expect(suggestCategory('ATACADAO', rules)).toBe('Casa');
  });
  it('sem casamento devolve null', () => {
    expect(suggestCategory('PIX MERCADINHO SOUZA', DEFAULT_RULES)).toBeNull();
  });
});
