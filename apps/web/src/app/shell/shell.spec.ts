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

  it('o avatar mostra as iniciais e o menu leva a Conta e dados e ao sair', async () => {
    const f = await criar();
    const el = f.nativeElement as HTMLElement;
    const avatar = el.querySelector('.topo-largo .avatar') as HTMLButtonElement;
    expect(avatar.textContent?.trim()).toBe('DT');
    avatar.click();
    await f.whenStable();
    const itens = [...el.querySelectorAll('.topo-largo [role^="menuitem"]')];
    expect(itens.map((i) => i.textContent?.trim().split('\n')[0])).toEqual([
      'Conta e dados',
      'Novidades',
      'Ocultar valores desligado',
      'Sair',
    ]);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    (itens[3] as HTMLButtonElement).click();
    await f.whenStable();
    expect(signOut).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/entrar');
  });
});
