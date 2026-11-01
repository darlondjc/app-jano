import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore/lite';
import { hashKey } from '@jano/import-file';
import { paths } from '../firebase/paths';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';

export interface ApelidoDoc {
  id: string;
  /** Trecho da descrição normalizada (maiúsculas, sem acento). */
  pattern: string;
  /** Nome que aparece no lugar da descrição do banco. */
  apelido: string;
  createdAt: string;
}

/** Apelidos: "toda transação cuja descrição contém X aparece como Y". */
@Injectable({ providedIn: 'root' })
export class ApelidosRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  list(uid: string): Promise<ApelidoDoc[]> {
    return this.cache.ler(`${uid}|apelidos`, async () => {
      const snap = await getDocs(collection(this.db, paths.apelidos(uid)));
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ApelidoDoc, 'id'>),
      }));
    });
  }

  /** O mesmo trecho sempre vira o mesmo documento: salvar de novo troca o apelido. */
  async save(
    uid: string,
    pattern: string,
    apelido: string,
  ): Promise<ApelidoDoc> {
    const p = pattern.trim().toUpperCase();
    const id = await hashKey(`apelido:${p}`);
    const data = {
      pattern: p,
      apelido: apelido.trim(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(this.db, paths.apelidos(uid), id), data);
    return { id, ...data };
  }

  async remove(uid: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, paths.apelidos(uid), id));
  }
}
