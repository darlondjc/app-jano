import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore/lite';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import { paths } from '../firebase/paths';

export interface BudgetDoc {
  /** Igual ao id da categoria: uma meta mensal por categoria. */
  categoryId: string;
  limitCents: number;
  /** O que sobrar no mês soma ao limite do mês seguinte. */
  rollover?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BudgetsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  list(uid: string): Promise<BudgetDoc[]> {
    return this.cache.ler(`${uid}|budgets`, () => this.listDoServidor(uid));
  }

  private async listDoServidor(uid: string): Promise<BudgetDoc[]> {
    const snap = await getDocs(collection(this.db, paths.budgets(uid)));
    return snap.docs.map((d) => ({
      categoryId: d.id,
      limitCents: d.get('limitCents') as number,
      rollover: d.get('rollover') === true,
    }));
  }

  async save(
    uid: string,
    categoryId: string,
    limitCents: number,
    rollover = false,
  ): Promise<void> {
    if (!Number.isInteger(limitCents) || limitCents < 0)
      throw new Error('Limite inválido.');
    await setDoc(doc(this.db, paths.budgets(uid), categoryId), {
      limitCents,
      rollover,
    });
  }

  async remove(uid: string, categoryId: string): Promise<void> {
    await deleteDoc(doc(this.db, paths.budgets(uid), categoryId));
  }
}
