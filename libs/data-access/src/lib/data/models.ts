export interface TransactionDoc {
  id: string;
  accountId: string;
  /** AAAA-MM-DD */
  date: string;
  /** Centavos, negativo = saída. */
  amountCents: number;
  description: string;
  descriptionNorm: string;
  dedupeKey: string;
  /** Id da categoria (slug) ou null = sem categoria. */
  categoryId: string | null;
  /** Escolha manual nunca é sobrescrita por regra. */
  categoryIsManual: boolean;
  isTransfer: boolean;
  importId: string | null;
  /** Final do cartão do titular (faturas com mais de um cartão). */
  holder?: string;
  /** Parcela "n de total". */
  installment?: { n: number; total: number };
}

export interface AccountDoc {
  id: string;
  nickname: string;
  type: 'conta' | 'cartao';
}

/** Saldo de uma conta no banco, gravado pela sincronização Open Finance (tools/pluggy-sync). */
export interface BalanceDoc {
  /** Id da conta no provedor. */
  id: string;
  name: string;
  kind: 'conta' | 'cartao';
  /** "corrente", "poupança", "cartão de crédito"... */
  detail: string | null;
  /** Conta do Jano ligada a ela, se houver. */
  accountId: string | null;
  /** Centavos. No cartão é o valor devido. */
  balanceCents: number;
  /** Última atualização no banco, quando o provedor informa (ISO 8601). */
  bankUpdatedAt: string | null;
  /** Quando a sincronização gravou (ISO 8601). */
  syncedAt: string;
}

export interface CategoryDoc {
  id: string;
  name: string;
  /** Nome do token de cor, ex.: "cat-3". */
  color: string;
  /** Chave do ícone (ver ICONS em @jano/ui). */
  icon: string;
  type: 'despesa' | 'receita';
  position: number;
}

/** Cores disponíveis para categorias (tokens do design system). */
export const CATEGORY_COLORS = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
] as const;

type DefaultCategory = Omit<CategoryDoc, 'id' | 'position'>;

/** Categorias sugeridas. A primeira vez cria todas; depois cada pessoa apaga e edita as suas. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Moradia', color: 'cat-1', icon: 'casa', type: 'despesa' },
  { name: 'Mercado', color: 'cat-3', icon: 'carrinho', type: 'despesa' },
  { name: 'Restaurantes', color: 'cat-8', icon: 'talheres', type: 'despesa' },
  { name: 'Transporte', color: 'cat-2', icon: 'carro', type: 'despesa' },
  { name: 'Combustível', color: 'cat-2', icon: 'combustivel', type: 'despesa' },
  { name: 'Saúde', color: 'cat-4', icon: 'saude', type: 'despesa' },
  { name: 'Farmácia', color: 'cat-4', icon: 'farmacia', type: 'despesa' },
  { name: 'Lazer', color: 'cat-6', icon: 'cinema', type: 'despesa' },
  { name: 'Assinaturas', color: 'cat-5', icon: 'assinatura', type: 'despesa' },
  { name: 'Educação', color: 'cat-7', icon: 'educacao', type: 'despesa' },
  {
    name: 'Celular e internet',
    color: 'cat-2',
    icon: 'internet',
    type: 'despesa',
  },
  { name: 'Compras', color: 'cat-7', icon: 'compras', type: 'despesa' },
  { name: 'Vestuário', color: 'cat-8', icon: 'roupa', type: 'despesa' },
  {
    name: 'Beleza e cuidados',
    color: 'cat-8',
    icon: 'beleza',
    type: 'despesa',
  },
  { name: 'Academia', color: 'cat-7', icon: 'academia', type: 'despesa' },
  { name: 'Viagens', color: 'cat-6', icon: 'viagem', type: 'despesa' },
  { name: 'Pets', color: 'cat-3', icon: 'pet', type: 'despesa' },
  { name: 'Filhos', color: 'cat-6', icon: 'crianca', type: 'despesa' },
  {
    name: 'Presentes e doações',
    color: 'cat-4',
    icon: 'presente',
    type: 'despesa',
  },
  {
    name: 'Casa e manutenção',
    color: 'cat-1',
    icon: 'manutencao',
    type: 'despesa',
  },
  { name: 'Seguros', color: 'cat-2', icon: 'seguro', type: 'despesa' },
  { name: 'Impostos e taxas', color: 'cat-5', icon: 'banco', type: 'despesa' },
  { name: 'Outros', color: 'cat-1', icon: 'outros', type: 'despesa' },
  { name: 'Receita', color: 'cat-1', icon: 'salario', type: 'receita' },
  {
    name: 'Rendimentos',
    color: 'cat-1',
    icon: 'investimento',
    type: 'receita',
  },
];

export const DEFAULT_ACCOUNTS: Omit<AccountDoc, 'id'>[] = [
  { nickname: 'Conta corrente', type: 'conta' },
  { nickname: 'Cartão de crédito', type: 'cartao' },
];

/** Id estável de categoria a partir do nome ("Saúde" → "saude"). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Primeiro e último dia (exclusivo) de um mês 'AAAA-MM', em strings de data. */
export function monthBounds(month: string): {
  from: string;
  toExclusive: string;
} {
  const [y, m] = month.split('-').map(Number);
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: `${month}-01`, toExclusive: `${next}-01` };
}
