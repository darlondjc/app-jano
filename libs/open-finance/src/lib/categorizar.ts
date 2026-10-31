import {
  DEFAULT_RULES,
  bankCategoryToName,
  isLikelyTransfer,
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
}

export interface LancamentoPronto {
  tx: KeyedTransaction;
  categoryId: string | null;
}

/**
 * Mesma decisão da prévia de importação da tela Transações: transferência fica sem categoria;
 * senão regra do usuário, dicionário padrão, grupo do banco e por fim a sugestão da fonte
 * (Pluggy ou ramo do estabelecimento). Só aceita categoria que existe na conta.
 */
export function categorizar(
  rows: KeyedTransaction[],
  categorias: CategoriaRef[],
  regras: RegraRef[],
): LancamentoPronto[] {
  const catIds = new Set(categorias.map((c) => c.id));
  const nomePorId = new Map(categorias.map((c) => [c.id, c.name]));
  return rows.map((raw) => {
    const tx = {
      ...raw,
      isTransfer: raw.isTransfer || isLikelyTransfer(raw.descriptionNorm),
    };
    if (tx.isTransfer) return { tx, categoryId: null };
    const regra = regras.find((r) => tx.descriptionNorm.includes(r.pattern));
    const nomeDaRegra = regra && nomePorId.get(regra.categoryId);
    // Em ordem de confiança; vale a primeira cuja categoria existe na conta (quem apagou
    // "Transporte" ainda recebe "Combustível" pelo ramo da loja).
    const candidatos = [
      nomeDaRegra,
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
