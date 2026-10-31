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

/** Objetivo de economia: quanto juntar e até quando. */
export interface GoalDoc {
  id: string;
  nome: string;
  alvoCents: number;
  /** AAAA-MM */
  prazo: string;
  /** De onde vem o guardado: saldo da poupança no banco ou valor informado. */
  fonte: 'poupanca' | 'manual';
  /** Só para fonte manual. */
  guardadoCents: number;
  criadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class GoalsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  list(uid: string): Promise<GoalDoc[]> {
    return this.cache.ler(`${uid}|goals`, async () => {
      const snap = await getDocs(collection(this.db, paths.goals(uid)));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<GoalDoc, 'id'>) }))
        .sort((a, b) => a.prazo.localeCompare(b.prazo));
    });
  }

  /** Cria (sem id) ou atualiza; devolve o objetivo gravado. */
  async save(
    uid: string,
    g: Omit<GoalDoc, 'id' | 'criadoEm'> & { id?: string; criadoEm?: string },
  ): Promise<GoalDoc> {
    if (!g.nome.trim()) throw new Error('Dê um nome ao objetivo.');
    if (!Number.isInteger(g.alvoCents) || g.alvoCents <= 0)
      throw new Error('Informe quanto quer juntar.');
    const id = g.id ?? crypto.randomUUID();
    const dados = {
      nome: g.nome.trim(),
      alvoCents: g.alvoCents,
      prazo: g.prazo,
      fonte: g.fonte,
      guardadoCents: g.fonte === 'manual' ? Math.max(0, g.guardadoCents) : 0,
      criadoEm: g.criadoEm ?? new Date().toISOString(),
    };
    await setDoc(doc(this.db, paths.goals(uid), id), dados);
    return { id, ...dados };
  }

  async remove(uid: string, id: string): Promise<void> {
    await deleteDoc(doc(this.db, paths.goals(uid), id));
  }
}
