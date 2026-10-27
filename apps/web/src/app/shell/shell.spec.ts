import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { Shell } from './shell';

describe('Shell', () => {
  const signOut = vi.fn().mockResolvedValue(undefined);

  async function criar() {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([{ path: 'entrar', children: [] }]),
        {
          provide: AuthService,
          useValue: { user: () => ({ displayName: 'Darlon Teste' }), signOut },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(Shell);
    await f.whenStable();
    return f;
  }

  it('mostra os itens do menu e os que ainda virão', async () => {
    const f = await criar();
    const el = f.nativeElement as HTMLElement;
    const links = [...el.querySelectorAll('aside nav a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['Início', 'Transações', 'Orçamento', 'Categorias']);
    expect(el.textContent).toContain('Avaliações');
    expect(el.textContent).toContain('em breve');
  });

  it('sair encerra a sessão e vai para o login', async () => {
    const f = await criar();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const sair = [...f.nativeElement.querySelectorAll('aside button')].find(
      (b: HTMLElement) => b.textContent?.trim() === 'Sair',
    ) as HTMLButtonElement;
    sair.click();
    await f.whenStable();
    expect(signOut).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/entrar');
  });
});
