import { Injectable, signal } from '@angular/core';

const BANCO = 'jano-cache';
const TABELA = 'leituras';

interface Guardado {
  valor: unknown;
  /** Quando foi lido do servidor (ISO 8601). */
  em: string;
}

/** Falta de rede, não erro de regra ou de dado. */
export function semConexao(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return true;
  const code = (e as { code?: string } | null)?.code;
  return code === 'unavailable' || e instanceof TypeError;
}

/**
 * Últimos dados lidos, guardados no aparelho (IndexedDB) para o app abrir sem internet.
 * O Firestore Lite não tem cache offline próprio. Só leitura: escrever continua exigindo rede.
 */
@Injectable({ providedIn: 'root' })
export class CacheLocal {
  /** Sem conexão: de quando são os dados mais antigos na tela. `null` = dados ao vivo. */
  readonly offlineDesde = signal<string | null>(null);
  private banco: Promise<IDBDatabase | null> | null = null;

  /** Lê do servidor e guarda; sem rede, devolve a última leitura guardada. */
  async ler<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    try {
      const valor = await buscar();
      this.offlineDesde.set(null);
      void this.gravar(chave, { valor, em: new Date().toISOString() });
      return valor;
    } catch (e) {
      const guardado = semConexao(e) ? await this.obter(chave) : undefined;
      if (!guardado) throw e;
      const atual = this.offlineDesde();
      if (!atual || guardado.em < atual) this.offlineDesde.set(guardado.em);
      return guardado.valor as T;
    }
  }

  /** Apaga tudo (ao sair da conta ou apagar os dados). */
  async limpar(): Promise<void> {
    const db = await this.abrir();
    if (!db) return;
    await new Promise<void>((ok) => {
      const tx = db.transaction(TABELA, 'readwrite');
      tx.objectStore(TABELA).clear();
      tx.oncomplete = tx.onerror = () => ok();
    });
    this.offlineDesde.set(null);
  }

  private abrir(): Promise<IDBDatabase | null> {
    // Sem IndexedDB (testes, navegação privada restrita): o app funciona, só não guarda.
    this.banco ??= new Promise((ok) => {
      try {
        const req = indexedDB.open(BANCO, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(TABELA);
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ok(null);
      } catch {
        ok(null);
      }
    });
    return this.banco;
  }

  private async gravar(chave: string, g: Guardado): Promise<void> {
    const db = await this.abrir();
    if (!db) return;
    try {
      db.transaction(TABELA, 'readwrite').objectStore(TABELA).put(g, chave);
    } catch {
      // Cache é complemento: falhar aqui não atrapalha a tela.
    }
  }

  private async obter(chave: string): Promise<Guardado | undefined> {
    const db = await this.abrir();
    if (!db) return undefined;
    return new Promise((ok) => {
      try {
        const req = db.transaction(TABELA).objectStore(TABELA).get(chave);
        req.onsuccess = () => ok(req.result as Guardado | undefined);
        req.onerror = () => ok(undefined);
      } catch {
        ok(undefined);
      }
    });
  }
}
