import {
  DEFAULT_RULES,
  bankCategoryToName,
  estabelecimento,
  isLikelyTransfer,
  regraQueCasa,
  suggestCategory,
  type KeyedTransaction,
} from '@jano/import-file';

export interface CategoriaRef {
  id: string;
  name: string;
}

/** Regra do usuário como fica no Firestore (trecho da descrição → id da categoria). */
export interface RegraRef {
  pattern: string;
  categoryId: string;
  createdAt?: string;
}

export interface LancamentoPronto {
  tx: KeyedTransaction;
  categoryId: string | null;
}

/**
 * Categoria de um lançamento novo. Regra sua vem antes de tudo, inclusive da detecção
 * automática de transferência. Sem regra: transferência fica sem categoria; senão dicionário
 * padrão, grupo do banco e por fim a sugestão da fonte (Pluggy ou ramo do estabelecimento).
 * Só aceita categoria que existe na conta.
 */
export function categorizar(
  rows: KeyedTransaction[],
  categorias: CategoriaRef[],
  regras: RegraRef[],
): LancamentoPronto[] {
  const catIds = new Set(categorias.map((c) => c.id));
  return rows.map((raw) => {
    const regra = regraQueCasa(raw.descriptionNorm, regras);
    if (regra && catIds.has(regra.categoryId))
      return {
        tx: { ...raw, isTransfer: false },
        categoryId: regra.categoryId,
      };
    const tx = {
      ...raw,
      isTransfer: raw.isTransfer || isLikelyTransfer(raw.descriptionNorm),
    };
    if (tx.isTransfer) return { tx, categoryId: null };
    // Em ordem de confiança; vale a primeira cuja categoria existe na conta (quem apagou
    // "Transporte" ainda recebe "Combustível" pelo ramo da loja).
    const candidatos = [
      suggestCategory(tx.descriptionNorm, DEFAULT_RULES),
      bankCategoryToName(tx.bankCategory),
      tx.suggestedCategory,
    ];
    for (const nome of candidatos) {
      if (!nome) continue;
      const id = categorias.find((c) => c.name === nome)?.id ?? slugify(nome);
      if (catIds.has(id)) return { tx, categoryId: id };
    }
    return { tx, categoryId: null };
  });
}

/** Igual ao `slugify` de @jano/data-access, que esta lib não pode importar (tags do Nx). */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Lançamento como gravado, só com o que importa para reaplicar regras. */
export interface LancamentoGravado {
  id: string;
  descriptionNorm: string;
  categoryId: string | null;
  categoryIsManual: boolean;
  isTransfer: boolean;
  splits?: unknown[];
}

/**
 * Lançamentos sem categoria que ganham a da mesma loja no histórico: a que você escolheu à
 * mão e, se nunca escolheu, a mais frequente entre as automáticas. "Mesma loja" compara só o
 * estabelecimento, sem prefixo nem hora ("COMPRA C CARTAO 17 15 PADARIA X" é "PADARIA X").
 * Só mexe no que está sem categoria, sem edição sua, sem divisão e não é transferência.
 */
export function inferirPeloHistorico(
  lancamentos: LancamentoGravado[],
  categorias: CategoriaRef[],
): { id: string; categoryId: string }[] {
  const catIds = new Set(categorias.map((c) => c.id));
  // loja → categoria → [manuais, automáticas]
  const contagem = new Map<string, Map<string, [number, number]>>();
  for (const t of lancamentos) {
    if (!t.categoryId || t.isTransfer || t.splits?.length) continue;
    if (!catIds.has(t.categoryId)) continue;
    const loja = estabelecimento(t.descriptionNorm);
    const porCat = contagem.get(loja) ?? new Map<string, [number, number]>();
    const n = porCat.get(t.categoryId) ?? [0, 0];
    n[t.categoryIsManual ? 0 : 1] += 1;
    porCat.set(t.categoryId, n);
    contagem.set(loja, porCat);
  }
  const escolhida = new Map<string, string>();
  for (const [loja, porCat] of contagem) {
    const [melhor] = [...porCat].sort(
      ([, a], [, b]) => b[0] - a[0] || b[1] - a[1],
    );
    escolhida.set(loja, melhor[0]);
  }
  const out: { id: string; categoryId: string }[] = [];
  for (const t of lancamentos) {
    if (t.categoryId || t.categoryIsManual || t.isTransfer || t.splits?.length)
      continue;
    const categoryId = escolhida.get(estabelecimento(t.descriptionNorm));
    if (categoryId) out.push({ id: t.id, categoryId });
  }
  return out;
}
