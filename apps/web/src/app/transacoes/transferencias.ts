import {
  type TransactionDoc,
  type TransactionsRepository,
} from '@jano/data-access';
import { isLikelyTransfer } from '@jano/import-file';

/**
 * Lançamentos já gravados que parecem transferência (pagar fatura, aplicar/resgatar) e ainda
 * não foram marcados. Escolha manual do usuário nunca é desfeita.
 */
export function pendentesDeTransferencia(txs: TransactionDoc[]): string[] {
  return txs
    .filter(
      (t) =>
        !t.isTransfer &&
        !t.categoryIsManual &&
        isLikelyTransfer(t.descriptionNorm),
    )
    .map((t) => t.id);
}

/** Marca no Firestore e devolve a lista já atualizada, com quantas foram marcadas. */
export async function marcarTransferencias(
  repo: TransactionsRepository,
  uid: string,
  txs: TransactionDoc[],
): Promise<{ txs: TransactionDoc[]; marcadas: number }> {
  const ids = pendentesDeTransferencia(txs);
  if (!ids.length) return { txs, marcadas: 0 };
  await repo.markTransfers(uid, ids);
  const set = new Set(ids);
  return {
    txs: txs.map((t) => (set.has(t.id) ? { ...t, isTransfer: true } : t)),
    marcadas: ids.length,
  };
}
