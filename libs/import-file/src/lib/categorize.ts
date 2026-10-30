export interface CategoryRule {
  /** Trecho que a descrição normalizada deve conter. */
  pattern: string;
  categoryName: string;
  /** Maior vence. Regras do usuário (prioridade alta) passam à frente do dicionário. */
  priority?: number;
}

/** Dicionário inicial de estabelecimentos comuns; o usuário refina com regras próprias. */
export const DEFAULT_RULES: CategoryRule[] = [
  { pattern: 'ATACADAO', categoryName: 'Mercado' },
  { pattern: 'PAO DE ACUCAR', categoryName: 'Mercado' },
  { pattern: 'CARREFOUR', categoryName: 'Mercado' },
  { pattern: 'ASSAI', categoryName: 'Mercado' },
  { pattern: 'SUPERMERCADO', categoryName: 'Mercado' },
  { pattern: 'IFOOD', categoryName: 'Restaurantes' },
  { pattern: 'PADARIA', categoryName: 'Restaurantes' },
  { pattern: 'RESTAURANTE', categoryName: 'Restaurantes' },
  { pattern: 'UBER', categoryName: 'Transporte' },
  { pattern: '99 POP', categoryName: 'Transporte' },
  { pattern: 'POSTO', categoryName: 'Transporte' },
  { pattern: 'IPIRANGA', categoryName: 'Transporte' },
  { pattern: 'DROGASIL', categoryName: 'Saúde' },
  { pattern: 'PAGUE MENOS', categoryName: 'Saúde' },
  { pattern: 'DROGARIA', categoryName: 'Saúde' },
  { pattern: 'FARMACIA', categoryName: 'Saúde' },
  { pattern: 'NETFLIX', categoryName: 'Assinaturas' },
  { pattern: 'SPOTIFY', categoryName: 'Assinaturas' },
  { pattern: 'DISNEY', categoryName: 'Assinaturas' },
  { pattern: 'CINEMARK', categoryName: 'Lazer' },
  { pattern: 'ENEL', categoryName: 'Moradia' },
  { pattern: 'SALARIO', categoryName: 'Receita' },
];

/**
 * Primeira regra que casa, por prioridade (e, no empate, a ordem da lista).
 * `null` = sem sugestão: a transação fica "Sem categoria" para o usuário escolher.
 */
export function suggestCategory(
  descriptionNorm: string,
  rules: CategoryRule[],
): string | null {
  const ordered = rules
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.priority ?? 0) - (a.r.priority ?? 0) || a.i - b.i);
  for (const { r } of ordered) {
    if (r.pattern && descriptionNorm.includes(r.pattern.toUpperCase()))
      return r.categoryName;
  }
  return null;
}
