import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideModoDemo } from '@jano/data-access';
import { Inicio } from './inicio';

describe('Início no modo demonstração', () => {
  // A demonstração monta os dados em volta de hoje: fixa um dia com a fatura fechada
  // (entre o fechamento, dia 27, e o vencimento, dia 7) para o teste não depender do calendário.
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-02T15:00:00Z'),
    });
  });
  afterEach(() => vi.useRealTimers());

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
    // A demonstração tem salário todo dia 5: o app conta por período.
    expect(texto).toContain('Gasto no período');
    expect(texto).toMatch(/\d+\/\w{3} – \d+\/\w{3}/);
    const fatura =
      (f.nativeElement as HTMLElement).querySelector('jano-fatura-cartao')
        ?.textContent ?? '';
    expect(fatura).toContain('Fatura fechada');
    expect(fatura).toContain('Limite usado');
    expect(fatura).toContain('Para onde foi');
    expect(fatura).toContain('Todo mês no cartão');
  });
});
