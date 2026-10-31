import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  BalancesRepository,
  BudgetsRepository,
  CatalogRepository,
  ContaRepository,
  InsightsRepository,
  TransactionsRepository,
  type BalanceDoc,
  type TransactionDoc,
} from '@jano/data-access';
import { mesAtual } from '../transacoes/agrupar';
import { Inicio } from './inicio';

const hoje = `${mesAtual(new Date())}-01`;

const tx: TransactionDoc = {
  id: 't1',
  accountId: 'conta-corrente',
  date: hoje,
  amountCents: -1000,
  description: 'PADARIA',
  descriptionNorm: 'PADARIA',
  dedupeKey: 'k',
  categoryId: null,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
};

function montar(saldos: BalanceDoc[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { user: () => ({ uid: 'u1', displayName: 'Ana' }) },
      },
      {
        provide: TransactionsRepository,
        useValue: { listRange: vi.fn().mockResolvedValue([tx]) },
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
        provide: ContaRepository,
        useValue: { ultimaImportacao: vi.fn().mockResolvedValue(null) },
      },
      {
        provide: BalancesRepository,
        useValue: { list: vi.fn().mockResolvedValue(saldos) },
      },
      {
        provide: InsightsRepository,
        useValue: { dispensados: vi.fn().mockResolvedValue([]) },
      },
    ],
  });
  const f = TestBed.createComponent(Inicio);
  return { f, el: f.nativeElement as HTMLElement };
}

async function pronto(f: ReturnType<typeof montar>['f']) {
  await vi.waitFor(() => {
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Carregando seu mês');
  });
}

const kpis = (el: HTMLElement) =>
  [...el.querySelectorAll('jano-kpi-card')].map((k) =>
    k.textContent?.replace(/\s+/g, ' ').trim(),
  );

describe('Inicio', () => {
  it('com Open Finance, o primeiro KPI é o saldo do banco', async () => {
    const { f, el } = montar([
      {
        id: 'cc',
        name: 'BB',
        kind: 'conta',
        detail: 'corrente',
        accountId: 'conta-corrente',
        balanceCents: 483217,
        bankUpdatedAt: null,
        syncedAt: new Date().toISOString(),
      },
    ]);
    await pronto(f);
    const destaque = el.querySelector('.j-hero')?.textContent ?? '';
    expect(destaque).toContain('4.832');
    expect(destaque).toContain('Conta corrente · atualizado hoje');
    expect(kpis(el)[0]).toContain('Gasto no mês');
  });

  it('sem Open Finance, mostra a sobra do mês', async () => {
    const { f, el } = montar([]);
    await pronto(f);
    expect(kpis(el)[0]).toContain('Sobra do mês');
    expect(el.querySelector('.j-hero')).toBeNull();
  });
});
