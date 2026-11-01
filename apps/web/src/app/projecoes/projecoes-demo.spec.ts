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

  it('objetivos: o de exemplo usa a poupança, e dá para criar outro', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideModoDemo()],
    });
    const f = TestBed.createComponent(Projecoes);
    const el = f.nativeElement as HTMLElement;
    const card = () => el.querySelector('jano-objetivos') as HTMLElement;
    await vi.waitFor(() => {
      f.detectChanges();
      expect(card()?.textContent).toContain('Reserva de emergência');
    });
    expect(card().textContent).toContain('saldo da poupança');
    expect(card().textContent).toMatch(/Guardar R\$\s?[\d.,]+ por mês até/);

    const botao = (t: string) =>
      [...card().querySelectorAll('button')].find((b) =>
        b.textContent?.trim().startsWith(t),
      ) as HTMLButtonElement;
    botao('Novo objetivo').click();
    f.detectChanges();
    const campo = (rotulo: string) =>
      card().querySelector(`[aria-label="${rotulo}"]`) as HTMLInputElement;
    campo('Nome do objetivo').value = 'Viagem';
    campo('Nome do objetivo').dispatchEvent(new Event('input'));
    campo('Quanto quer juntar').value = '6.000,00';
    campo('Quanto quer juntar').dispatchEvent(new Event('input'));
    botao('Informar valor').click();
    f.detectChanges();
    botao('Salvar').click();
    await vi.waitFor(() => {
      f.detectChanges();
      expect(card().textContent).toContain('Viagem');
      expect(card().textContent).toContain('Juntos pedem');
    });
  });
});
