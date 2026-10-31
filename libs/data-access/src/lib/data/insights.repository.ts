import { Injectable, inject } from '@angular/core';
import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import { paths } from '../firebase/paths';

/** Insights dispensados, por mês (documento users/{uid}/insights/{AAAA-MM}). */
@Injectable({ providedIn: 'root' })
export class InsightsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  dispensados(uid: string, month: string): Promise<string[]> {
    return this.cache.ler(`${uid}|insights|${month}`, async () => {
      const snap = await getDoc(doc(this.db, paths.insights(uid), month));
      return (snap.get('dispensados') as string[] | undefined) ?? [];
    });
  }

  async dispensar(uid: string, month: string, id: string): Promise<void> {
    await setDoc(
      doc(this.db, paths.insights(uid), month),
      { dispensados: arrayUnion(id) },
      { merge: true },
    );
  }
}
