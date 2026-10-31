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
  { pattern: 'YOUTUBE', categoryName: 'Assinaturas' },
  { pattern: 'APPLE COM BILL', categoryName: 'Assinaturas' },
  { pattern: 'HBO', categoryName: 'Assinaturas' },
  { pattern: 'PRIME VIDEO', categoryName: 'Assinaturas' },
  { pattern: 'GLOBOPLAY', categoryName: 'Assinaturas' },
  { pattern: 'DEEZER', categoryName: 'Assinaturas' },
  { pattern: 'PARAMOUNT', categoryName: 'Assinaturas' },
  { pattern: 'CRUNCHYROLL', categoryName: 'Assinaturas' },
  { pattern: 'ANTHROPIC', categoryName: 'Assinaturas' },
  { pattern: 'OPENAI', categoryName: 'Assinaturas' },
  { pattern: 'CHATGPT', categoryName: 'Assinaturas' },
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

/** Palavras de operação bancária: uma regra feita só delas casaria com quase tudo. */
const PALAVRAS_DE_OPERACAO = new Set([
  'COMPRA',
  'C',
  'COM',
  'CARTAO',
  'NO',
  'DEBITO',
  'CREDITO',
  'PAGAMENTO',
  'PAGTO',
  'PIX',
  'TED',
  'DOC',
  'TRANSFERENCIA',
  'TRANSF',
  'ENVIADO',
  'RECEBIDO',
]);

/**
 * Trecho que não identifica nenhuma loja: curto demais ou só palavras de operação e hora
 * ("COMPRA C CARTAO", "PIX ENVIADO", "COMPRA C CARTAO 17 15").
 */
export function regraGenerica(pattern: string): boolean {
  const p = pattern.trim();
  if (p.length < 3) return true;
  return p
    .split(/\s+/)
    .every((w) => PALAVRAS_DE_OPERACAO.has(w) || /^\d{1,2}$/.test(w));
}

/**
 * A regra do usuário que vale para a descrição: entre as que casam, a de trecho mais longo
 * (mais específica) e, no empate, a mais recente. Regras genéricas não valem.
 */
export function regraQueCasa<R extends { pattern: string; createdAt?: string }>(
  descriptionNorm: string,
  regras: readonly R[],
): R | undefined {
  let melhor: R | undefined;
  for (const r of regras) {
    if (regraGenerica(r.pattern) || !descriptionNorm.includes(r.pattern))
      continue;
    if (
      !melhor ||
      r.pattern.length > melhor.pattern.length ||
      (r.pattern.length === melhor.pattern.length &&
        (r.createdAt ?? '') > (melhor.createdAt ?? ''))
    )
      melhor = r;
  }
  return melhor;
}
