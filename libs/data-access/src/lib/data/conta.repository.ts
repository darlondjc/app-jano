import { Injectable, inject } from '@angular/core';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';
import { paths } from '../firebase/paths';
import { FirebaseService } from '../firebase/firebase.service';

const BATCH_LIMIT = 400; // Firestore aceita 500 operações por lote.

/** Coleções do usuário incluídas na exportação e na exclusão. */
const COLECOES = [
  'accounts',
  'categories',
  'budgets',
  'rules',
  'imports',
  'transactions',
  'recurrences',
  'scenarios',
  'insights',
] as const;

export type NomeColecao = (typeof COLECOES)[number];
export type DadosDoUsuario = Record<
  NomeColecao,
  ({ id: string } & Record<string, unknown>)[]
>;

export interface RegistroImportacao {
  id: string;
  fileName: string;
  added: number;
  duplicates: number;
  createdAt: string;
}

/** Operações sobre todos os dados do usuário: última importação, exportar e apagar. */
@Injectable({ providedIn: 'root' })
export class ContaRepository {
  private readonly db = inject(FirebaseService).db;

  async ultimaImportacao(uid: string): Promise<RegistroImportacao | null> {
    const snap = await getDocs(
      query(
        collection(this.db, paths.imports(uid)),
        orderBy('createdAt', 'desc'),
        limit(1),
      ),
    );
    const d = snap.docs[0];
    return d
      ? { id: d.id, ...(d.data() as Omit<RegistroImportacao, 'id'>) }
      : null;
  }

  async exportar(uid: string): Promise<DadosDoUsuario> {
    const saida = {} as DadosDoUsuario;
    for (const nome of COLECOES) {
      const snap = await getDocs(collection(this.db, paths[nome](uid)));
      saida[nome] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return saida;
  }

  /** Apaga tudo o que está sob users/{uid}; a conta de login continua existindo. */
  async apagarTudo(uid: string): Promise<number> {
    let total = 0;
    for (const nome of COLECOES) {
      const snap = await getDocs(collection(this.db, paths[nome](uid)));
      for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(this.db);
        for (const d of snap.docs.slice(i, i + BATCH_LIMIT))
          batch.delete(d.ref);
        await batch.commit();
      }
      total += snap.docs.length;
    }
    return total;
  }
}
