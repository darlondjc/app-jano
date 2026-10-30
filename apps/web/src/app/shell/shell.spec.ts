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

  it('mostra os itens do menu lateral', async () => {
    const f = await criar();
    const el = f.nativeElement as HTMLElement;
    const links = [...el.querySelectorAll('aside nav a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual([
      'Início',
      'Transações',
      'Orçamento',
      'Avaliações',
      'Projeções',
      'Recorrências',
      'Categorias',
    ]);
    expect(el.textContent).not.toContain('em breve');
  });

  it('no celular as abas são as principais e "Mais" abre o resto', async () => {
    const f = await criar();
    const el = f.nativeElement as HTMLElement;
    const abas = [...el.querySelectorAll('nav.abas .j-nav__item')].map((a) =>
      a.textContent?.trim(),
    );
    expect(abas).toEqual([
      'Início',
      'Transações',
      'Orçamento',
      'Projeções',
      'Mais',
    ]);
    (el.querySelector('nav.abas button') as HTMLButtonElement).click();
    await f.whenStable();
    const mais = [...el.querySelectorAll('.mais [role="menuitem"]')].map(
      (a) => a.textContent?.trim().split('\n')[0],
    );
    expect(mais).toEqual([
      'Avaliações',
      'Recorrências',
      'Categorias',
      'Conta e dados',
      'Novidades',
    ]);
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
