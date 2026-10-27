import { Component } from '@angular/core';
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
