import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { paths } from '../firebase/paths';
import { FirebaseService } from '../firebase/firebase.service';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  slugify,
  type AccountDoc,
  type CategoryDoc,
} from './models';

/** Contas e categorias do usuário; cria os padrões na primeira vez. */
@Injectable({ providedIn: 'root' })
export class CatalogRepository {
  private readonly db = inject(FirebaseService).db;

  async accounts(uid: string): Promise<AccountDoc[]> {
    const col = collection(this.db, paths.accounts(uid));
    let snap = await getDocs(col);
    if (snap.empty) {
      const batch = writeBatch(this.db);
      for (const a of DEFAULT_ACCOUNTS)
        batch.set(doc(col, slugify(a.nickname)), a);
      await batch.commit();
      snap = await getDocs(col);
    }
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AccountDoc, 'id'>),
    }));
  }

  async categories(uid: string): Promise<CategoryDoc[]> {
    const col = collection(this.db, paths.categories(uid));
    let snap = await getDocs(col);
    if (snap.empty) {
      const batch = writeBatch(this.db);
      for (const c of DEFAULT_CATEGORIES)
        batch.set(doc(col, slugify(c.name)), c);
      await batch.commit();
      snap = await getDocs(col);
    }
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<CategoryDoc, 'id'>) }))
      .sort((a, b) => a.position - b.position);
  }

  async saveImportRecord(
    uid: string,
    importId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await setDoc(doc(this.db, paths.imports(uid), importId), data);
  }
}
