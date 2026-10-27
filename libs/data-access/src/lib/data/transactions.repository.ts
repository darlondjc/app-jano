import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { hashKey, type KeyedTransaction } from '@jano/import-file';
import { paths } from '../firebase/paths';
import { FirebaseService } from '../firebase/firebase.service';
import { monthBounds, type TransactionDoc } from './models';

const BATCH_LIMIT = 400; // Firestore aceita 500 operações por lote.

@Injectable({ providedIn: 'root' })
export class TransactionsRepository {
  private readonly db = inject(FirebaseService).db;

  async listMonth(uid: string, month: string): Promise<TransactionDoc[]> {
    const { from, toExclusive } = monthBounds(month);
    const snap = await getDocs(
      query(
        collection(this.db, paths.transactions(uid)),
        where('date', '>=', from),
        where('date', '<', toExclusive),
        orderBy('date', 'desc'),
      ),
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<TransactionDoc, 'id'>),
    }));
  }

  /** Chaves já gravadas no período do arquivo (para a prévia). */
  async existingKeys(
    uid: string,
    from: string,
    to: string,
  ): Promise<Set<string>> {
    const snap = await getDocs(
      query(
        collection(this.db, paths.transactions(uid)),
        where('date', '>=', from),
        where('date', '<=', to),
      ),
    );
    return new Set(snap.docs.map((d) => d.get('dedupeKey') as string));
  }

  /** Grava só as novas, já com a categoria sugerida. O id do documento é o hash da chave. */
  async commitImport(
    uid: string,
    accountId: string,
    importId: string,
    rows: { tx: KeyedTransaction; categoryId: string | null }[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const { tx, categoryId } of rows.slice(i, i + BATCH_LIMIT)) {
        const id = await hashKey(tx.dedupeKey);
        const data: Omit<TransactionDoc, 'id'> = {
          accountId,
          date: tx.date,
          amountCents: tx.amountCents,
          description: tx.description,
          descriptionNorm: tx.descriptionNorm,
          dedupeKey: tx.dedupeKey,
          categoryId,
          categoryIsManual: false,
          isTransfer: tx.isTransfer ?? false,
          importId,
          ...(tx.holder ? { holder: tx.holder } : {}),
          ...(tx.installment ? { installment: tx.installment } : {}),
        };
        batch.set(doc(this.db, paths.transactions(uid), id), data);
      }
      await batch.commit();
    }
  }

  async setCategory(
    uid: string,
    id: string,
    categoryId: string | null,
  ): Promise<void> {
    await updateDoc(doc(this.db, paths.transactions(uid), id), {
      categoryId,
      categoryIsManual: true,
    });
  }
}
