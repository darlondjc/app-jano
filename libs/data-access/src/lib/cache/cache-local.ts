import { Injectable, signal } from '@angular/core';

const BANCO = 'jano-cache';
const TABELA = 'leituras';

interface Guardado {
  valor: unknown;
  /** Quando foi lido do servidor (ISO 8601). */
  em: string;
}

/** Cota diária do plano gratuito do Firestore esgotada (50 mil leituras; zera às 4h). */
export function cotaEsgotada(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'resource-exhausted';
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
  /** Por que os dados vêm do aparelho: sem internet ou cota do servidor esgotada. */
  readonly motivo = signal<'offline' | 'cota'>('offline');
  private banco: Promise<IDBDatabase | null> | null = null;

  /** Lê do servidor e guarda; sem rede, devolve a última leitura guardada. */
  async ler<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    try {
      const valor = await buscar();
      this.offlineDesde.set(null);
      void this.gravar(chave, { valor, em: new Date().toISOString() });
      return valor;
    } catch (e) {
      const cota = cotaEsgotada(e);
      const guardado =
        semConexao(e) || cota ? await this.obter(chave) : undefined;
      if (!guardado) {
        if (cota)
          throw Object.assign(
            new Error(
              'O limite diário de leituras do servidor acabou. Volta por volta das 4h da manhã.',
            ),
            { code: 'resource-exhausted' },
          );
        throw e;
      }
      this.motivo.set(cota ? 'cota' : 'offline');
      const atual = this.offlineDesde();
      if (!atual || guardado.em < atual) this.offlineDesde.set(guardado.em);
      return guardado.valor as T;
    }
  }

  /** O que está guardado no aparelho para a chave, sem ir ao servidor. */
  async guardado<T>(
    chave: string,
  ): Promise<{ valor: T; em: string } | undefined> {
    const g = await this.obter(chave);
    return g ? { valor: g.valor as T, em: g.em } : undefined;
  }

  /** Guarda um valor já conhecido (ex.: depois de uma escrita), como se viesse do servidor agora. */
  async guardar(chave: string, valor: unknown): Promise<void> {
    await this.gravar(chave, { valor, em: new Date().toISOString() });
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
