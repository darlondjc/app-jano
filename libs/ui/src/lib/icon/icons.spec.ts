import { TestBed } from '@angular/core/testing';
import { JanoIcon } from './icon';
import { ICON_NAMES, ICONS, iconInnerSvg } from './icons';

describe('icons', () => {
  it('todo ícone tem rótulo e desenho', () => {
    for (const name of ICON_NAMES) {
      expect(ICONS[name].label).toBeTruthy();
      expect(iconInnerSvg(name)).toMatch(
        /^<(path|circle|rect|line|polyline|polygon|ellipse)/,
      );
    }
  });
  it('nome desconhecido cai no ícone padrão', () => {
    expect(iconInnerSvg('nao-existe')).toBe(iconInnerSvg('etiqueta'));
  });
});

describe('JanoIcon', () => {
  it('renderiza o svg e é decorativo sem label', () => {
    const f = TestBed.createComponent(JanoIcon);
    f.componentRef.setInput('name', 'carrinho');
    f.detectChanges();
    const svg = f.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.querySelectorAll('path,circle').length).toBeGreaterThan(0);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
