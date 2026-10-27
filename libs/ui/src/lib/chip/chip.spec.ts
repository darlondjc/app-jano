import { TestBed } from '@angular/core/testing';
import { JanoChip } from './chip';

describe('JanoChip', () => {
  it('alterna aria-pressed ao clicar', () => {
    const f = TestBed.createComponent(JanoChip);
    f.detectChanges();
    const btn: HTMLButtonElement = f.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    f.detectChanges();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(f.componentInstance.pressed()).toBe(true);
  });
});
