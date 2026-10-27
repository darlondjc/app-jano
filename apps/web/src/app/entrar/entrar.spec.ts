import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { Entrar, mensagemDeErro } from './entrar';

describe('mensagemDeErro', () => {
  it.each([
    ['auth/popup-closed-by-user', 'cancelado'],
    ['auth/popup-blocked', 'pop-ups'],
    ['auth/network-request-failed', 'conexão'],
    ['auth/unauthorized-domain', 'autorizado'],
    ['qualquer/outro', 'não funcionou'],
  ])('%s', (code, trecho) =>
    expect(mensagemDeErro({ code })).toContain(trecho),
  );
});

describe('Entrar', () => {
  function montar(signIn: () => Promise<void>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signInWithGoogle: signIn } },
      ],
    });
    const f = TestBed.createComponent(Entrar);
    f.detectChanges();
    return f;
  }
  const botao = (f: ReturnType<typeof montar>) =>
    f.nativeElement.querySelector('.gbtn') as HTMLButtonElement;

  it('mostra erro e o botão "Tentar de novo" se o login falhar', async () => {
    const f = montar(() =>
      Promise.reject({ code: 'auth/popup-closed-by-user' }),
    );
    botao(f).click();
    await f.whenStable();
    f.detectChanges();
    expect(
      f.nativeElement.querySelector('[role=alert]')?.textContent,
    ).toContain('cancelado');
    expect(botao(f).textContent).toContain('Tentar de novo');
  });

  it('vai para a tela inicial quando o login dá certo', async () => {
    const f = montar(() => Promise.resolve());
    const nav = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    botao(f).click();
    await f.whenStable();
    expect(nav).toHaveBeenCalledWith('/');
  });
});
