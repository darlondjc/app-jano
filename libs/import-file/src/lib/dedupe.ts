import { normalizeDescription } from './normalize';
import type { RawTransaction } from './types';

export interface KeyedTransaction extends RawTransaction {
  descriptionNorm: string;
  /** Vira o id do documento no Firestore: o mesmo lançamento sempre gera a mesma chave. */
  dedupeKey: string;
}

/**
 * Chave estável por lançamento.
 * - Com FITID: `f:{accountId}:{FITID}` (único por conta).
 * - Sem FITID: conta + data + valor + descrição normalizada + sequência no dia, para duas
 *   compras idênticas no mesmo dia não colapsarem em uma.
 */
export function addDedupeKeys(
  accountId: string,
  rows: RawTransaction[],
): KeyedTransaction[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const descriptionNorm = normalizeDescription(row.description);
    let dedupeKey: string;
    if (row.externalId) {
      dedupeKey = `f:${accountId}:${row.externalId}`;
    } else {
      const base = `${accountId}|${row.date}|${row.amountCents}|${descriptionNorm}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      dedupeKey = `h:${base}|${n}`;
    }
    return { ...row, descriptionNorm, dedupeKey };
  });
}

/** SHA-256 em hex: id de documento seguro (sem "/" nem tamanho excessivo). */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
