import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideModoDemo } from '@jano/data-access';
import { Projecoes } from './projecoes';

describe('Projeções no modo demonstração', () => {
  it('abre com o plano do mês acima do longo prazo', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideModoDemo()],
    });
    const f = TestBed.createComponent(Projecoes);
    await vi.waitFor(() => {
      f.detectChanges();
      expect(f.nativeElement.querySelector('jano-plano-mes')).not.toBeNull();
    });
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Até o salário');
    expect(texto).toContain('O que vem nos próximos 30 dias');
    expect(texto).toContain('Fatura do cartão');
    expect(texto).toContain('Renda já comprometida');
    expect(texto).toContain('Longo prazo');
    expect(texto).not.toContain('(R$ 0,00)');
  });
});
