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
}

export interface AccountDoc {
  id: string;
  nickname: string;
  type: 'conta' | 'cartao';
}

export interface CategoryDoc {
  id: string;
  name: string;
  /** Nome do token de cor, ex.: "cat-3". */
  color: string;
  type: 'despesa' | 'receita';
  position: number;
}

export const DEFAULT_CATEGORIES: Omit<CategoryDoc, 'id'>[] = [
  { name: 'Moradia', color: 'cat-1', type: 'despesa', position: 0 },
  { name: 'Mercado', color: 'cat-3', type: 'despesa', position: 1 },
  { name: 'Restaurantes', color: 'cat-8', type: 'despesa', position: 2 },
  { name: 'Transporte', color: 'cat-2', type: 'despesa', position: 3 },
  { name: 'Saúde', color: 'cat-4', type: 'despesa', position: 4 },
  { name: 'Lazer', color: 'cat-6', type: 'despesa', position: 5 },
  { name: 'Assinaturas', color: 'cat-5', type: 'despesa', position: 6 },
  { name: 'Educação', color: 'cat-7', type: 'despesa', position: 7 },
  { name: 'Outros', color: 'cat-1', type: 'despesa', position: 8 },
  { name: 'Receita', color: 'cat-1', type: 'receita', position: 9 },
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
