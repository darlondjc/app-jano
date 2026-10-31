import { TestBed } from '@angular/core/testing';
import { JanoMonthNav } from './month-nav';

function montar(navegavel = true) {
  const f = TestBed.createComponent(JanoMonthNav);
  f.componentRef.setInput('rotulo', 'Outubro 2026');
  f.componentRef.setInput('navegavel', navegavel);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const seta = (rotulo: string) =>
    el.querySelector(`[aria-label="${rotulo}"]`) as HTMLButtonElement;
  return { f, el, seta };
}

describe('JanoMonthNav', () => {
  it('mostra o mês e avisa anterior e próximo', () => {
    const { f, el, seta } = montar();
    const eventos: string[] = [];
    f.componentInstance.anterior.subscribe(() => eventos.push('anterior'));
    f.componentInstance.proximo.subscribe(() => eventos.push('proximo'));
    expect(el.textContent).toContain('Outubro 2026');
    seta('Mês anterior').click();
    seta('Próximo mês').click();
    expect(eventos).toEqual(['anterior', 'proximo']);
  });

  it('sem navegação, as setas ficam desativadas e escondidas', () => {
    const { el, seta } = montar(false);
    expect(seta('Mês anterior').disabled).toBe(true);
    expect(seta('Próximo mês').disabled).toBe(true);
    expect(el.classList).toContain('fixo');
  });

  it('com opções, o rótulo abre o menu e a escolha fecha', () => {
    const f = TestBed.createComponent(JanoMonthNav);
    f.componentRef.setInput('rotulo', 'Outubro 2026');
    f.componentRef.setInput('opcoes', [
      { id: 'este', rotulo: 'Este mês', ativo: true },
      { id: '3m', rotulo: 'Últimos 3 meses', ativo: false },
    ]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const escolhas: string[] = [];
    f.componentInstance.opcao.subscribe((id) => escolhas.push(id));
    (el.querySelector('button.rotulo') as HTMLButtonElement).click();
    f.detectChanges();
    const itens = [...el.querySelectorAll('[role="menuitemradio"]')];
    expect(itens.map((b) => b.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ]);
    (itens[1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(escolhas).toEqual(['3m']);
    expect(el.querySelector('[role="menu"]')).toBeNull();
  });
});
