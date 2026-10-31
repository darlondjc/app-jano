import { ehEstorno, formatBRL, partes } from '@jano/engine';

export type TipoFiltro = 'gastos' | 'receitas' | 'transferencias';

export interface Filtros {
  busca: string;
  tipo: TipoFiltro | null;
  /** Ids de categoria; '' = sem categoria. Vazio = todas. */
  categorias: string[];
  /** Id da conta ou null = todas. */
  conta: string | null;
  /** Só lançamentos sem categoria (fora transferências). */
  semCategoria: boolean;
  /** Só os que chegaram categorizados sozinhos e você ainda não confirmou (ver `precisaRevisar`). */
  revisar: boolean;
}

export const SEM_FILTROS: Filtros = {
  busca: '',
  tipo: null,
  categorias: [],
  conta: null,
  semCategoria: false,
  revisar: false,
};

/** Dias para trás que contam como "chegou agora" em Para revisar. */
export const DIAS_PARA_REVISAR = 30;

/**
 * Chegou nos últimos 30 dias com categoria automática (regra, dicionário, banco) ou sem
 * nenhuma, e você ainda não confirmou nem mudou. Transferências ficam de fora.
 */
export function precisaRevisar(
  t: { date: string; categoryIsManual: boolean; isTransfer: boolean },
  desde: string,
): boolean {
  return !t.categoryIsManual && !t.isTransfer && t.date >= desde;
}

/** Data (AAAA-MM-DD) a partir da qual um lançamento conta para Para revisar. */
export function inicioParaRevisar(hoje = new Date()): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() - DIAS_PARA_REVISAR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Linha {
  accountId: string;
  description: string;
  descriptionNorm: string;
  amountCents: number;
  categoryId: string | null;
  isTransfer: boolean;
  categoryIsManual?: boolean;
  date?: string;
  splits?: { categoryId: string | null; amountCents: number }[];
}

const simples = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function totalDeFiltros(f: Filtros): number {
  return (
    (f.tipo ? 1 : 0) +
    (f.categorias.length ? 1 : 0) +
    (f.conta ? 1 : 0) +
    (f.semCategoria ? 1 : 0) +
    (f.revisar ? 1 : 0)
  );
}

/** Busca por nome, categoria ou valor ("186", "186,42"). */
export function casaBusca(
  t: Linha,
  busca: string,
  nomeCategoria: (id: string | null) => string,
): boolean {
  const q = simples(busca.trim());
  if (!q) return true;
  if (
    simples(t.description).includes(q) ||
    simples(nomeCategoria(t.categoryId)).includes(q)
  )
    return true;
  if (/^\d[\d.,]*$/.test(q)) {
    const valor = formatBRL(Math.abs(t.amountCents))
      .replace(/[^\d,]/g, '')
      .replace(/^0+(?=\d)/, '');
    return valor.includes(q.replace(/\./g, ''));
  }
  return false;
}

export function filtrar<T extends Linha>(
  txs: T[],
  f: Filtros,
  nomeCategoria: (id: string | null) => string,
  cartoes?: ReadonlySet<string>,
  /** Início da janela de Para revisar; por padrão, 30 dias antes de hoje. */
  revisarDesde?: string,
): T[] {
  return txs.filter((t) => {
    if (f.conta && t.accountId !== f.conta) return false;
    const estorno = ehEstorno(t, cartoes);
    if (
      f.tipo === 'gastos' &&
      !((t.amountCents < 0 || estorno) && !t.isTransfer)
    )
      return false;
    if (
      f.tipo === 'receitas' &&
      !(t.amountCents > 0 && !t.isTransfer && !estorno)
    )
      return false;
    if (f.tipo === 'transferencias' && !t.isTransfer) return false;
    if (f.semCategoria && (t.categoryId !== null || t.isTransfer)) return false;
    if (
      f.revisar &&
      !precisaRevisar(
        {
          date: t.date ?? '',
          categoryIsManual: !!t.categoryIsManual,
          isTransfer: t.isTransfer,
        },
        revisarDesde ?? inicioParaRevisar(),
      )
    )
      return false;
    // Lançamento dividido aparece no filtro de qualquer categoria das suas partes.
    if (
      f.categorias.length &&
      !partes(t).some((p) => f.categorias.includes(p.categoryId ?? ''))
    )
      return false;
    return casaBusca(t, f.busca, nomeCategoria);
  });
}
