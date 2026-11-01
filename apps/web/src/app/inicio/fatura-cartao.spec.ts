import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { gerarDadosDemo } from '@jano/data-access';
import { cartaoDaFatura, type DiasDaFatura } from './fatura';
import { FaturaCartaoCard } from './fatura-cartao';

const d = gerarDadosDemo(new Date(2026, 10, 1, 10));
const saldos = d.balances.map((b) =>
  b.kind === 'cartao'
    ? { ...b, credito: undefined, faturaAberta: undefined }
    : b,
);
const entrada = {
  saldos,
  txs: d.transactions,
  cartoes: new Set(['cartao-de-credito']),
  hoje: '2026-11-01',
};

function montar(dias: DiasDaFatura | null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const f = TestBed.createComponent(FaturaCartaoCard);
  f.componentRef.setInput('fatura', cartaoDaFatura({ ...entrada, dias })!);
  f.detectChanges();
  const salvos: DiasDaFatura[] = [];
  f.componentInstance.salvarDias.subscribe((v) => salvos.push(v));
  return { f, el: f.nativeElement as HTMLElement, salvos };
}

describe('FaturaCartaoCard: dias informados', () => {
  it('sem datas do banco, oferece informar e envia os dias', () => {
    const { f, el, salvos } = montar(null);
    const link = el.querySelector('.link-dias') as HTMLButtonElement;
    expect(link.textContent).toContain('informar fechamento e vencimento');
    link.click();
    f.detectChanges();
    (el.querySelector('#dia-fecha') as HTMLInputElement).value = '25';
    (el.querySelector('#dia-vence') as HTMLInputElement).value = '5';
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(salvos).toEqual([{ fecha: 25, vence: 5 }]);
  });

  it('dia inválido mostra o erro e não envia', () => {
    const { f, el, salvos } = montar(null);
    (el.querySelector('.link-dias') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('#dia-fecha') as HTMLInputElement).value = '40';
    (el.querySelector('#dia-vence') as HTMLInputElement).value = '5';
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(salvos).toEqual([]);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('1 a 31');
  });

  it('com os dias, mostra as datas e o atalho para alterar', () => {
    const { el } = montar({ fecha: 25, vence: 5 });
    expect(el.textContent).toContain('Fatura fechada');
    expect(el.textContent).toContain('Fecha dia 25, vence dia 5');
  });
});
