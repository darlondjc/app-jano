import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JanoButton } from './button';

@Component({
  imports: [JanoButton],
  template: `<button janoButton variant="secondary" [large]="true">
    Salvar
  </button>`,
})
class Host {}

describe('JanoButton', () => {
  it('aplica as classes do design system', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('button');
    expect(el.className).toBe('j-btn j-btn--lg j-btn--secondary');
    expect(el.textContent).toContain('Salvar');
  });
});

@Component({
  imports: [JanoButton],
  template: `<button
    janoButton
    [carregando]="carregando()"
    textoCarregando="Salvando…"
  >
    Salvar
  </button>`,
})
class HostCarregando {
  carregando = signal(false);
}

describe('JanoButton carregando', () => {
  it('mostra o indicador e o texto de espera, e volta ao rótulo', () => {
    const f = TestBed.createComponent(HostCarregando);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('button');
    expect(el.textContent?.trim()).toBe('Salvar');
    f.componentInstance.carregando.set(true);
    f.detectChanges();
    expect(el.querySelector('.j-btn__gira')).not.toBeNull();
    expect(el.textContent?.trim()).toBe('Salvando…');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.className).toContain('j-btn--carregando');
  });
});
