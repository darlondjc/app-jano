import { TestBed } from '@angular/core/testing';
import { FirebaseService } from '../firebase/firebase.service';
import { TransactionsRepository } from './transactions.repository';

const leituras: string[] = [];

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
  getDoc: async () => ({ exists: () => false }),
  updateDoc: async () => undefined,
  writeBatch: () => ({
    update: () => undefined,
    commit: async () => undefined,
  }),
  deleteField: () => undefined,
}));

describe('TransactionsRepository na memória', () => {
  beforeEach(() => {
    leituras.length = 0;
    TestBed.configureTestingModule({
      providers: [{ provide: FirebaseService, useValue: { db: {} } }],
    });
  });

  it('meses já lidos não voltam ao servidor, de uma tela para outra', async () => {
    const repo = TestBed.inject(TransactionsRepository);
    const a = await repo.listRange('u', '2026-08', '2026-10');
    expect(a.map((t) => t.id)).toEqual(['t-2026-10', 't-2026-09', 't-2026-08']);
    await repo.listRange('u', '2026-07', '2026-10');
    await repo.listMonth('u', '2026-10');
    expect(leituras).toEqual(['2026-08', '2026-09', '2026-10', '2026-07']);
  });

  it('a categoria gravada aparece na próxima leitura sem reler', async () => {
    const repo = TestBed.inject(TransactionsRepository);
    await repo.listMonth('u', '2026-10');
    await repo.setCategory('u', 't-2026-10', 'mercado');
    const [t] = await repo.listMonth('u', '2026-10');
    expect(t.categoryId).toBe('mercado');
    expect(t.categoryIsManual).toBe(true);
    expect(leituras).toEqual(['2026-10']);
  });
});
