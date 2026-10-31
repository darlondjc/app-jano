import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideModoDemo } from '@jano/data-access';
import { Transacoes } from './transacoes';

describe('Transações no modo demonstração', () => {
  it('?revisar=1 abre em Para revisar, e confirmar todas esvazia a lista', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideModoDemo()],
    });
    const f = TestBed.createComponent(Transacoes);
    f.componentRef.setInput('revisar', '1');
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('.barra-revisar')).not.toBeNull();
    });
    const chip = () =>
      [...el.querySelectorAll('.j-chip')].find((c) =>
        c.textContent?.includes('Para revisar'),
      );
    expect(chip()?.getAttribute('aria-pressed')).toBe('true');
    expect(Number(chip()?.textContent?.match(/\d+/)?.[0])).toBeGreaterThan(0);
    const todas = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Confirmar todas'),
    ) as HTMLButtonElement;
    todas.click();
    await vi.waitFor(() => {
      f.detectChanges();
      expect(chip()?.textContent).toContain('Para revisar · 0');
    });
  });
});
