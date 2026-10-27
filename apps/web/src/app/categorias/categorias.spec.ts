import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthService,
  CatalogRepository,
  type CategoryDoc,
} from '@jano/data-access';
import { Categorias } from './categorias';

const cat = (
  id: string,
  name: string,
  type: 'despesa' | 'receita' = 'despesa',
): CategoryDoc => ({
  id,
  name,
  color: 'cat-3',
  icon: 'carrinho',
  type,
  position: 0,
});

function montar(lista: CategoryDoc[]) {
  const repo = {
    categories: vi.fn().mockResolvedValue(lista),
    saveCategory: vi.fn().mockResolvedValue('x'),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
    addMissingDefaults: vi.fn().mockResolvedValue(3),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user: () => ({ uid: 'u1' }) } },
      { provide: CatalogRepository, useValue: repo },
    ],
  });
  const f = TestBed.createComponent(Categorias);
  return { f, repo, el: f.nativeElement as HTMLElement };
}
const pronto = async (f: ReturnType<typeof montar>['f']) => {
  await f.whenStable();
  f.detectChanges();
};
const btn = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === texto,
  ) as HTMLButtonElement;

describe('Categorias', () => {
  it('separa despesas e receitas e oferece as sugeridas que faltam', async () => {
    const { f, el } = montar([
      cat('mercado', 'Mercado'),
      cat('receita', 'Receita', 'receita'),
    ]);
    f.detectChanges();
    await pronto(f);
    const titulos = [...el.querySelectorAll('h2')].map((h) => h.textContent);
    expect(titulos).toEqual(['Despesas', 'Receitas']);
    expect(el.textContent).toContain('categorias sugeridas');
    expect(el.querySelectorAll('.item')).toHaveLength(2);
  });

  it('cria categoria com nome, cor e ícone escolhidos', async () => {
    const { f, repo, el } = montar([cat('mercado', 'Mercado')]);
    f.detectChanges();
    await pronto(f);
    btn(el, 'Nova categoria').click();
    f.detectChanges();
    const input = el.querySelector(
      'input[aria-label="Nome da categoria"]',
    ) as HTMLInputElement;
    input.value = 'Cafeteria';
    input.dispatchEvent(new Event('input'));
    (el.querySelector('[aria-label="Cor 5"]') as HTMLButtonElement).click();
    (el.querySelector('[aria-label="Café"]') as HTMLButtonElement).click();
    f.detectChanges();
    btn(el, 'Salvar').click();
    await pronto(f);
    expect(repo.saveCategory).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        id: undefined,
        name: 'Cafeteria',
        color: 'cat-5',
        icon: 'cafe',
        type: 'despesa',
      }),
      expect.any(Array),
    );
    expect(el.textContent).toContain('Categoria criada.');
  });

  it('pede confirmação antes de apagar', async () => {
    const { f, repo, el } = montar([cat('mercado', 'Mercado')]);
    f.detectChanges();
    await pronto(f);
    (
      el.querySelector('[aria-label="Apagar Mercado"]') as HTMLButtonElement
    ).click();
    f.detectChanges();
    expect(repo.deleteCategory).not.toHaveBeenCalled();
    expect(el.querySelector('[role=alertdialog]')?.textContent).toContain(
      'ficam sem categoria',
    );
    (el.querySelector('[role=alertdialog]') as HTMLElement)
      .querySelectorAll('button')[1]
      .click();
    await pronto(f);
    expect(repo.deleteCategory).toHaveBeenCalledWith('u1', 'mercado');
  });

  it('mostra o erro de nome repetido vindo do repositório', async () => {
    const { f, repo, el } = montar([cat('mercado', 'Mercado')]);
    repo.saveCategory.mockRejectedValue(
      new Error('Já existe uma categoria com esse nome.'),
    );
    f.detectChanges();
    await pronto(f);
    (
      el.querySelector('[aria-label="Editar Mercado"]') as HTMLButtonElement
    ).click();
    f.detectChanges();
    btn(el, 'Salvar').click();
    await pronto(f);
    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      'Já existe uma categoria',
    );
  });
});
