import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  BudgetsRepository,
  CatalogRepository,
  TransactionsRepository,
  type BudgetDoc,
  type TransactionDoc,
} from '@jano/data-access';
import { mesAnterior } from '../transacoes/agrupar';
import { Orcamento } from './orcamento';

const mes = new Date().toISOString().slice(0, 7);

const tx = (date: string, amountCents: number): TransactionDoc => ({
  id: date + amountCents,
  accountId: 'conta',
  date,
  amountCents,
  description: 'MERCADO',
  descriptionNorm: 'MERCADO',
  dedupeKey: 'k',
  categoryId: 'mercado',
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
});

function montar(metas: BudgetDoc[], anterior: TransactionDoc[]) {
  const budgets = {
    list: vi.fn().mockResolvedValue(metas),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { user: () => ({ uid: 'u1' }) } },
      { provide: BudgetsRepository, useValue: budgets },
      {
        provide: CatalogRepository,
        useValue: {
          categories: vi.fn().mockResolvedValue([
            {
              id: 'mercado',
              name: 'Mercado',
              type: 'despesa',
              color: 'cat-3',
              icon: 'carrinho',
              position: 0,
            },
          ]),
          accounts: vi.fn().mockResolvedValue([]),
        },
      },
      {
        provide: TransactionsRepository,
        useValue: {
          listMonth: vi.fn((_: string, m: string) =>
            Promise.resolve(
              m === mes
                ? [tx(`${mes}-05`, -30000)]
                : m === mesAnterior(mes)
                  ? anterior
                  : [],
            ),
          ),
        },
      },
    ],
  });
  const f = TestBed.createComponent(Orcamento);
  return { f, el: f.nativeElement as HTMLElement, budgets };
}

function abrirMeta(f: ReturnType<typeof montar>['f']) {
  (f.nativeElement.querySelector('button.meta') as HTMLButtonElement).click();
  f.detectChanges();
}

async function pronto(f: ReturnType<typeof montar>['f']) {
  await vi.waitFor(() => {
    f.detectChanges();
    expect(f.nativeElement.querySelector('jano-goal-bar')).not.toBeNull();
  });
}

describe('Orcamento: levar a sobra para o mês seguinte', () => {
  it('com rollover, o limite ganha o que sobrou no mês anterior', async () => {
    const { f, el } = montar(
      [{ categoryId: 'mercado', limitCents: 90000, rollover: true }],
      [tx(`${mesAnterior(mes)}-10`, -70000)],
    );
    await pronto(f);
    abrirMeta(f);
    expect(el.textContent).toMatch(/inclui R\$\s200,00 que sobraram/);
    // O campo de edição mostra o limite gravado, sem a sobra.
    expect((el.querySelector('#lim-mercado') as HTMLInputElement).value).toBe(
      '900,00',
    );
  });

  it('mês anterior sem dados não inventa sobra', async () => {
    const { f, el } = montar(
      [{ categoryId: 'mercado', limitCents: 90000, rollover: true }],
      [],
    );
    await pronto(f);
    expect(el.textContent).not.toContain('que sobraram');
  });

  it('ligar a opção e salvar grava a meta com rollover e fecha a folha', async () => {
    const { f, el, budgets } = montar(
      [{ categoryId: 'mercado', limitCents: 90000, rollover: false }],
      [],
    );
    await pronto(f);
    abrirMeta(f);
    (el.querySelector('#sobra-meta') as HTMLInputElement).checked = true;
    const salvar = [
      ...el.querySelectorAll<HTMLButtonElement>('.folha button'),
    ].find((b) => b.textContent?.trim() === 'Salvar')!;
    salvar.click();
    await vi.waitFor(() =>
      expect(budgets.save).toHaveBeenCalledWith('u1', 'mercado', 90000, true),
    );
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('.folha')).toBeNull();
    });
  });

  it('resumo: quanto ainda cabe nas metas', async () => {
    const { f, el } = montar(
      [{ categoryId: 'mercado', limitCents: 90000, rollover: false }],
      [],
    );
    await pronto(f);
    expect(el.querySelector('.resumo .j-hero__valor')?.textContent).toMatch(
      /R\$\s600,00/,
    );
  });
});
