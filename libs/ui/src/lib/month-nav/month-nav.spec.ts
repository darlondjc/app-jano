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
});
