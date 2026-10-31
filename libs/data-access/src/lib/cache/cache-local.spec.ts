import { TestBed } from '@angular/core/testing';
import { CacheLocal, semConexao } from './cache-local';

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
});
