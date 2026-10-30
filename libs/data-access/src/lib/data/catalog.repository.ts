import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../firebase/firebase.service';
import { paths } from '../firebase/paths';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  slugify,
  type AccountDoc,
  type CategoryDoc,
} from './models';

const BATCH_LIMIT = 400;

/** Id livre a partir do nome: "Saúde" → "saude"; se existir, "saude-2", "saude-3"... */
export function uniqueCategoryId(
  name: string,
  taken: ReadonlySet<string>,
): string {
  const base = slugify(name) || 'categoria';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Sugeridas que ainda não existem (pelo id), com a posição seguinte à maior atual. */
export function missingDefaults(
  existing: CategoryDoc[],
): Omit<CategoryDoc, 'id'>[] {
  const have = new Set(existing.map((c) => c.id));
  let position = existing.reduce((m, c) => Math.max(m, c.position), -1) + 1;
  return DEFAULT_CATEGORIES.filter((d) => !have.has(slugify(d.name))).map(
    (d) => ({
      ...d,
      position: position++,
    }),
  );
}

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
      DEFAULT_CATEGORIES.forEach((c, position) =>
        batch.set(doc(col, slugify(c.name)), { ...c, position }),
      );
      await batch.commit();
      snap = await getDocs(col);
    }
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Partial<CategoryDoc>),
    }));
    // Categorias criadas antes dos ícones existirem: completa pelo padrão de mesmo id.
    const fixes = list.filter((c) => !c.icon);
    if (fixes.length) {
      const batch = writeBatch(this.db);
      for (const c of fixes) {
        const def = DEFAULT_CATEGORIES.find((d) => slugify(d.name) === c.id);
        c.icon = def?.icon ?? 'etiqueta';
        batch.update(doc(col, c.id), { icon: c.icon });
      }
      await batch.commit();
    }
    return (list as CategoryDoc[]).sort(
      (a, b) =>
        a.position - b.position || a.name.localeCompare(b.name, 'pt-BR'),
    );
  }

  /** Cria (sem `id`) ou atualiza (com `id`) uma categoria e devolve o id. */
  async saveCategory(
    uid: string,
    cat: Omit<CategoryDoc, 'id' | 'position'> & {
      id?: string;
      position?: number;
    },
    existing: CategoryDoc[],
  ): Promise<string> {
    const name = cat.name.trim();
    if (!name) throw new Error('Dê um nome para a categoria.');
    const dup = existing.some(
      (c) =>
        c.id !== cat.id && c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) throw new Error('Já existe uma categoria com esse nome.');
    const col = collection(this.db, paths.categories(uid));
    const id =
      cat.id ?? uniqueCategoryId(name, new Set(existing.map((c) => c.id)));
    const position =
      cat.position ??
      existing.reduce((m, c) => Math.max(m, c.position), -1) + 1;
    await setDoc(doc(col, id), {
      name,
      color: cat.color,
      icon: cat.icon,
      type: cat.type,
      position,
    });
    return id;
  }

  async addMissingDefaults(
    uid: string,
    existing: CategoryDoc[],
  ): Promise<number> {
    const missing = missingDefaults(existing);
    if (!missing.length) return 0;
    const col = collection(this.db, paths.categories(uid));
    const batch = writeBatch(this.db);
    for (const c of missing) batch.set(doc(col, slugify(c.name)), c);
    await batch.commit();
    return missing.length;
  }

  /**
   * Apaga a categoria: as transações dela ficam sem categoria, a meta é removida e as
   * regras que apontavam para ela também.
   */
  async deleteCategory(uid: string, id: string): Promise<void> {
    const txSnap = await getDocs(
      query(
        collection(this.db, paths.transactions(uid)),
        where('categoryId', '==', id),
      ),
    );
    for (let i = 0; i < txSnap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const d of txSnap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.update(d.ref, { categoryId: null, categoryIsManual: true });
      }
      await batch.commit();
    }
    await deleteDoc(doc(this.db, paths.budgets(uid), id));
    await deleteDoc(doc(this.db, paths.categories(uid), id));
  }

  async saveImportRecord(
    uid: string,
    importId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await setDoc(doc(this.db, paths.imports(uid), importId), data);
  }
}
