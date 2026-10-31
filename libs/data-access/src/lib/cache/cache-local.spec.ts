import { TestBed } from '@angular/core/testing';
import { CacheLocal, cotaEsgotada, semConexao } from './cache-local';

describe('CacheLocal', () => {
  it('semConexao reconhece falta de rede, não erro de regra', () => {
    expect(semConexao({ code: 'unavailable' })).toBe(true);
    expect(semConexao(new TypeError('Failed to fetch'))).toBe(true);
    expect(semConexao({ code: 'permission-denied' })).toBe(false);
  });

  it('sem IndexedDB, repassa a leitura e o erro sem quebrar', async () => {
    const cache = TestBed.inject(CacheLocal);
    expect(await cache.ler('k', async () => 42)).toBe(42);
    await expect(
      cache.ler('k', async () => {
        throw { code: 'unavailable' };
      }),
    ).rejects.toEqual({ code: 'unavailable' });
    expect(cache.offlineDesde()).toBeNull();
  });

  it('reconhece a cota esgotada do Firestore', () => {
    expect(cotaEsgotada({ code: 'resource-exhausted' })).toBe(true);
    expect(cotaEsgotada({ code: 'permission-denied' })).toBe(false);
    expect(cotaEsgotada(null)).toBe(false);
  });

  it('cota esgotada sem nada guardado vira mensagem em português', async () => {
    const cache = TestBed.inject(CacheLocal);
    const falha = Object.assign(new Error('Quota exceeded.'), {
      code: 'resource-exhausted',
    });
    await expect(
      cache.ler('chave-que-nao-existe', () => Promise.reject(falha)),
    ).rejects.toThrow('O limite diário de leituras do servidor acabou');
  });
});
