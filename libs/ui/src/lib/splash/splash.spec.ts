import { TestBed } from '@angular/core/testing';
import { JanoSplash, SPLASH_FULL_MS, SPLASH_REDUCED_MS } from './splash';

describe('JanoSplash', () => {
  it('renderiza símbolo, nome e slogan com rótulos de acessibilidade', () => {
    const f = TestBed.createComponent(JanoSplash);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toContain(
      'chave de duas faces',
    );
    expect(el.querySelector('.nome')?.textContent).toBe('jano');
    expect(el.querySelector('.slogan')?.textContent).toContain(
      'Planeje o que vem',
    );
    expect(el.querySelector('[role=progressbar]')).toBeTruthy();
  });
  it('a versão reduzida é bem mais curta', () => {
    expect(SPLASH_REDUCED_MS).toBeLessThan(SPLASH_FULL_MS / 2);
  });
});
