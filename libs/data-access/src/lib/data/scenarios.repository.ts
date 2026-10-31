import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import { paths } from '../firebase/paths';

/** Cenários "e se" da tela Projeções, como a pessoa deixou. */
export interface CenariosDoc {
  cortarLigado: boolean;
  categoriaCorte: string;
  parcelaLigada: boolean;
  parcelaTexto: string;
  rendaLigada: boolean;
  rendaTexto: string;
  horizonte: number;
}

const ID = 'projecoes';

@Injectable({ providedIn: 'root' })
export class ScenariosRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  get(uid: string): Promise<CenariosDoc | null> {
    return this.cache.ler(`${uid}|scenarios`, async () => {
      const snap = await getDoc(doc(this.db, paths.scenarios(uid), ID));
      return snap.exists() ? (snap.data() as CenariosDoc) : null;
    });
  }

  async save(uid: string, c: CenariosDoc): Promise<void> {
    await setDoc(doc(this.db, paths.scenarios(uid), ID), c);
  }
}
