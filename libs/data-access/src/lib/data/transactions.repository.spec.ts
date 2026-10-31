import { TestBed } from '@angular/core/testing';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import { TransactionsRepository, mesFechado } from './transactions.repository';

const leituras: string[] = [];
let meta: Record<string, string> = {};

vi.mock('firebase/firestore/lite', () => ({
  collection: () => ({}),
  doc: (_db: unknown, _p: string, id: string) => ({ id }),
  query: (_c: unknown, de: { v: string }) => de,
  where: (_campo: string, op: string, v: string) =>
    op === '>=' ? { v } : undefined,
  orderBy: () => undefined,
  getDocs: async (q: { v?: string }) => {
    const mes = q.v?.slice(0, 7) ?? 'tudo';
    leituras.push(mes);
    return {
      docs: [
        {
          id: `t-${mes}`,
          data: () => ({ date: `${mes}-10`, categoryId: null }),
        },
      ],
    };
  },
  getDoc: async (ref: { id: string }) => ({
    exists: () => ref.id === 'meses',
    data: () => meta,
  }),
  setDoc: async (_ref: unknown, campos: Record<string, string>) => {
    meta = { ...meta, ...campos };
  },
  updateDoc: async () => undefined,
  writeBatch: () => ({
    update: () => undefined,
    commit: async () => undefined,
  }),
  deleteField: () => undefined,
}));

/** IndexedDB de mentira, compartilhado entre "sessões" (instâncias do repositório). */
class CacheFalso {
  readonly guardados = new Map<string, { valor: unknown; em: string }>();
  async ler<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    const valor = await buscar();
    this.guardados.set(chave, { valor, em: new Date().toISOString() });
    return valor;
  }
  async guardado<T>(chave: string) {
    return this.guardados.get(chave) as { valor: T; em: string } | undefined;
  }
  async guardar(chave: string, valor: unknown) {
    this.guardados.set(chave, { valor, em: new Date().toISOString() });
  }
}

describe('TransactionsRepository: cache', () => {
  let cache: CacheFalso;
  const sessao = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseService, useValue: { db: {} } },
        { provide: CacheLocal, useValue: cache },
      ],
    });
    return TestBed.inject(TransactionsRepository);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T12:00:00'));
    leituras.length = 0;
    meta = {};
    cache = new CacheFalso();
  });
  afterEach(() => vi.useRealTimers());

  it('mês fechado é o que terminou há mais de 45 dias', () => {
    const hoje = new Date('2026-10-31T12:00:00');
    expect(mesFechado('2026-08', hoje)).toBe(true);
    expect(mesFechado('2026-09', hoje)).toBe(false);
    expect(mesFechado('2026-10', hoje)).toBe(false);
  });

  it('meses já lidos não voltam ao servidor, de uma tela para outra', async () => {
    const repo = sessao();
    const a = await repo.listRange('u', '2026-08', '2026-10');
    expect(a.map((t) => t.id)).toEqual(['t-2026-10', 't-2026-09', 't-2026-08']);
    await repo.listRange('u', '2026-07', '2026-10');
    await repo.listMonth('u', '2026-10');
    expect(leituras.sort()).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('noutra sessão, mês fechado vem do aparelho e o aberto do servidor', async () => {
    await sessao().listRange('u', '2026-07', '2026-10');
    leituras.length = 0;
    await sessao().listRange('u', '2026-07', '2026-10');
    expect(leituras.sort()).toEqual(['2026-09', '2026-10']);
  });

  it('mês fechado alterado em outro aparelho volta ao servidor', async () => {
    await sessao().listRange('u', '2026-07', '2026-08');
    leituras.length = 0;
    vi.setSystemTime(new Date('2026-10-31T13:00:00'));
    meta = { '2026-07': new Date().toISOString() };
    await sessao().listRange('u', '2026-07', '2026-08');
    expect(leituras).toEqual(['2026-07']);
  });

  it('editar aqui marca o mês e atualiza a cópia do aparelho, sem reler', async () => {
    const repo = sessao();
    await repo.listMonth('u', '2026-07');
    await repo.setCategory('u', 't-2026-07', 'mercado');
    expect(Object.keys(meta)).toEqual(['2026-07']);
    leituras.length = 0;
    vi.setSystemTime(new Date('2026-10-31T13:00:00'));
    const [t] = await sessao().listMonth('u', '2026-07');
    expect(t.categoryId).toBe('mercado');
    expect(leituras).toEqual([]);
  });
});
