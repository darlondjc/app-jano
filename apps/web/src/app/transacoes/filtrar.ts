import { nomeDeExibicao } from '@jano/import-file';
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
}

export const SEM_FILTROS: Filtros = {
  busca: '',
  tipo: null,
  categorias: [],
  conta: null,
  semCategoria: false,
};

interface Linha {
  accountId: string;
  description: string;
  descriptionNorm: string;
  amountCents: number;
  categoryId: string | null;
  isTransfer: boolean;
  splits?: { categoryId: string | null; amountCents: number }[];
}

const simples = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function totalDeFiltros(f: Filtros): number {
  return (
    (f.tipo ? 1 : 0) +
    (f.categorias.length ? 1 : 0) +
    (f.conta ? 1 : 0) +
    (f.semCategoria ? 1 : 0)
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
    // O nome que aparece na lista (apelido ou nome limpo) também é buscável.
    simples(nomeDeExibicao(t.description)).includes(q) ||
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
    // Lançamento dividido aparece no filtro de qualquer categoria das suas partes.
    if (
      f.categorias.length &&
      !partes(t).some((p) => f.categorias.includes(p.categoryId ?? ''))
    )
      return false;
    return casaBusca(t, f.busca, nomeCategoria);
  });
}

export interface Totais {
  n: number;
  /** Gasto líquido (compras menos estornos), em centavos positivos. */
  gastosCents: number;
  entradasCents: number;
  /** Só no filtro de transferências: quanto passou entre contas. */
  transferidoCents: number;
}

/**
 * Totais do que a lista mostra. Transferência fica fora de gastos e entradas (como no resto do
 * app); com filtro de categoria, um lançamento dividido conta só as partes daquelas categorias.
 */
export function totalizar<T extends Linha>(
  txs: T[],
  f: Filtros,
  cartoes?: ReadonlySet<string>,
): Totais {
  const r: Totais = {
    n: txs.length,
    gastosCents: 0,
    entradasCents: 0,
    transferidoCents: 0,
  };
  for (const t of txs) {
    if (t.isTransfer) {
      r.transferidoCents += Math.abs(t.amountCents);
      continue;
    }
    const valor = f.categorias.length
      ? partes(t)
          .filter((p) => f.categorias.includes(p.categoryId ?? ''))
          .reduce((s, p) => s + p.amountCents, 0)
      : t.amountCents;
    if (valor < 0) r.gastosCents += -valor;
    else if (ehEstorno(t, cartoes)) r.gastosCents -= valor;
    else r.entradasCents += valor;
  }
  return r;
}
