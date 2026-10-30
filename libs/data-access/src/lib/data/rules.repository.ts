import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore/lite';
import { hashKey } from '@jano/import-file';
import { paths } from '../firebase/paths';
import { FirebaseService } from '../firebase/firebase.service';

export interface RuleDoc {
  id: string;
  /** Trecho da descrição normalizada (maiúsculas, sem acento). */
  pattern: string;
  categoryId: string;
  createdAt: string;
}

/** Regras do usuário: "sempre que a descrição contiver X, usar a categoria Y". */
@Injectable({ providedIn: 'root' })
export class RulesRepository {
  private readonly db = inject(FirebaseService).db;

  async list(uid: string): Promise<RuleDoc[]> {
    const snap = await getDocs(collection(this.db, paths.rules(uid)));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RuleDoc, 'id'>),
    }));
  }

  /** O mesmo trecho sempre vira o mesmo documento, então regra repetida só troca a categoria. */
  async save(
    uid: string,
    pattern: string,
    categoryId: string,
  ): Promise<RuleDoc> {
    const p = pattern.trim().toUpperCase();
    const id = await hashKey(`regra:${p}`);
    const data = {
      pattern: p,
      categoryId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(this.db, paths.rules(uid), id), data);
    return { id, ...data };
  }
}
