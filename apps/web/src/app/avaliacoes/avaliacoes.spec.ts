import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  BudgetsRepository,
  CatalogRepository,
  InsightsRepository,
  TransactionsRepository,
  type TransactionDoc,
} from '@jano/data-access';
import { Avaliacoes } from './avaliacoes';

const tx = (date: string, reais: number, cat = 'mercado'): TransactionDoc => ({
  id: `${date}-${reais}`,
  accountId: 'cc',
  date,
  amountCents: -reais * 100,
  description: 'MERCADO',
  descriptionNorm: 'MERCADO',
  dedupeKey: `${date}-${reais}`,
  categoryId: cat,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
});

describe('Avaliações no dia 1, sem lançamentos no mês', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 1, 9));
  });
  afterEach(() => vi.useRealTimers());

  it('lê o mês que fechou em vez de pedir importação', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ uid: 'u1' }) } },
        {
          provide: TransactionsRepository,
          useValue: {
            listRange: vi
              .fn()
              .mockResolvedValue([
                tx('2026-09-10', 500),
                tx('2026-10-10', 600),
                tx('2026-10-20', 90),
              ]),
          },
        },
        {
          provide: BudgetsRepository,
          useValue: { list: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: CatalogRepository,
          useValue: {
            categories: vi.fn().mockResolvedValue([]),
            accounts: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: InsightsRepository,
          useValue: { dispensados: vi.fn().mockResolvedValue([]) },
        },
      ],
    });
    const f = TestBed.createComponent(Avaliacoes);
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('.frase')).not.toBeNull();
    });
    expect(el.textContent).not.toContain('Ainda não há o que avaliar');
    expect(el.textContent).toContain('Outubro 2026 · mês fechado');
    expect(el.querySelector('.frase')?.textContent).toMatch(
      /^Outubro fechou com R\$\s690,00 de gastos, 38% mais que setembro\.$/,
    );
  });
});
