import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideModoDemo } from '@jano/data-access';
import { Inicio } from './inicio';

describe('Início no modo demonstração', () => {
  it('abre com o destaque, o "pode gastar" e os indicadores, sem Firebase', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideModoDemo()],
    });
    const f = TestBed.createComponent(Inicio);
    await vi.waitFor(() => {
      f.detectChanges();
      expect(f.nativeElement.querySelector('.j-hero')).not.toBeNull();
    });
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Olá, Visitante');
    expect(texto).toContain('17.680'); // conta corrente e poupança
    expect(texto).toContain('Pode gastar até o salário');
    expect(texto).toContain('Gasto no mês');
  });
});
