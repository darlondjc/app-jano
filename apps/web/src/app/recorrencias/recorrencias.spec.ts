import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  CatalogRepository,
  TransactionsRepository,
  type TransactionDoc,
} from '@jano/data-access';
import { previousMonths } from '@jano/engine';
import { mesAtual } from '../transacoes/agrupar';
import { Recorrencias } from './recorrencias';

const mes = mesAtual(new Date());
const meses = [...previousMonths(mes, 2).reverse(), mes];

const tx = (
  m: string,
  description: string,
  cents: number,
  categoryId: string,
): TransactionDoc => ({
  id: m + description,
  accountId: 'conta',
  date: `${m}-01`,
  amountCents: cents,
  description,
  descriptionNorm: description.toUpperCase(),
  dedupeKey: m + description,
  categoryId,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
});

function montar() {
  localStorage.removeItem('jano.recorrencias.fechados');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user: () => ({ uid: 'u1' }) } },
      {
        provide: TransactionsRepository,
        useValue: {
          listRange: vi
            .fn()
            .mockResolvedValue(
              meses.flatMap((m) => [
                tx(m, 'Netflix', -3990, 'assinaturas'),
                tx(m, 'Aluguel', -150000, 'moradia'),
              ]),
            ),
          markTransfers: vi.fn(),
        },
      },
      {
        provide: CatalogRepository,
        useValue: {
          accounts: vi.fn().mockResolvedValue([]),
          categories: vi.fn().mockResolvedValue([
            {
              id: 'assinaturas',
              name: 'Assinaturas',
              type: 'despesa',
              color: 'cat-5',
              icon: 'assinatura',
              position: 0,
            },
            {
              id: 'moradia',
              name: 'Moradia',
              type: 'despesa',
              color: 'cat-1',
              icon: 'casa',
              position: 1,
            },
          ]),
        },
      },
    ],
  });
  const f = TestBed.createComponent(Recorrencias);
  return { f, el: f.nativeElement as HTMLElement };
}

describe('Recorrencias', () => {
  it('agrupa e deixa recolher cada grupo', async () => {
    const { f, el } = montar();
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('button.grupo')).not.toBeNull();
    });
    const grupos = [...el.querySelectorAll<HTMLButtonElement>('button.grupo')];
    expect(
      grupos.map((g) => g.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual([
      expect.stringMatching(/^Assinaturas 1 ?−R\$\s39,90\/mês$/),
      expect.stringMatching(/^Contas fixas 1 ?−R\$\s1\.500,00\/mês$/),
    ]);
    expect(el.textContent).toContain('Netflix');

    grupos[0].click();
    f.detectChanges();
    expect(grupos[0].getAttribute('aria-expanded')).toBe('false');
    expect(el.textContent).not.toContain('Netflix');
    expect(el.textContent).toContain('Aluguel');
    expect(localStorage.getItem('jano.recorrencias.fechados')).toBe(
      '["assinaturas"]',
    );

    grupos[0].click();
    f.detectChanges();
    expect(el.textContent).toContain('Netflix');
  });
});
