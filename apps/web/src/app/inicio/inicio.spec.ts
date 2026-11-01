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

function montar(saldos: BalanceDoc[], txs: TransactionDoc[] = [tx]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { user: () => ({ uid: 'u1', displayName: 'Ana' }) },
      },
      {
        provide: TransactionsRepository,
        useValue: { listRange: vi.fn().mockResolvedValue(txs) },
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

  it('dia 1 sem lançamentos no mês, mas com histórico: tela normal, não "Vamos começar"', async () => {
    const [a, m] = mesAtual(new Date()).split('-').map(Number);
    const anterior = new Date(a, m - 2, 28);
    const data = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}-28`;
    const { f, el } = montar([], [{ ...tx, date: data }]);
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.textContent).toContain('Últimas transações');
    });
    expect(el.textContent).not.toContain('Vamos começar');
    expect(el.textContent).toContain('ainda; a sincronização diária');
    expect(el.textContent).toContain('Padaria');
  });

  it('sem nenhum lançamento: "Vamos começar"', async () => {
    const { f, el } = montar([], []);
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.textContent).toContain('Vamos começar');
    });
  });
});
