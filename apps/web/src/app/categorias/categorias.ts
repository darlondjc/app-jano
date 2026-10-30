import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuthService,
  CATEGORY_COLORS,
  CatalogRepository,
  missingDefaults,
  type CategoryDoc,
} from '@jano/data-access';
import {
  ICON_NAMES,
  ICONS,
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoIcon,
  JanoSkeletonGroup,
  JanoSkeletonRows,
} from '@jano/ui';

interface Form {
  id?: string;
  name: string;
  type: 'despesa' | 'receita';
  color: string;
  icon: string;
}

const NOVA: Form = {
  name: '',
  type: 'despesa',
  color: 'cat-1',
  icon: 'etiqueta',
};

@Component({
  selector: 'jano-categorias',
  imports: [
    JanoButton,
    JanoBanner,
    JanoCategoryBadge,
    JanoIcon,
    JanoSkeletonGroup,
    JanoSkeletonRows,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    h2 {
      margin: 28px 0 8px;
      font: 600 16px/24px var(--font-sans);
    }
    .lista {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--surface);
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
    }
    .item:last-child {
      border-bottom: 0;
    }
    .item .nome {
      flex: 1;
      font: 500 16px/24px var(--font-sans);
    }
    .item .acoes {
      display: flex;
      gap: 4px;
    }
    .conf {
      background: var(--danger-soft);
      padding: 12px 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      font: 400 14px/20px var(--font-sans);
    }
    .form {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cores,
    .icones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .cor {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cor[aria-pressed='true'] {
      border-color: var(--text);
    }
    .cor:focus-visible,
    .ico:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .ico {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .ico[aria-pressed='true'] {
      background: var(--primary-soft);
      border-color: var(--primary);
      color: var(--primary-text);
    }
    .tipos {
      display: flex;
      gap: 8px;
    }
    .previa {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rodape {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .sug {
      margin-top: 16px;
    }
  `,
  template: `
    <header>
      <div>
        <h1>Categorias</h1>
        <div class="j-sub">{{ categorias().length }} categorias</div>
      </div>
      @if (!form()) {
        <button janoButton variant="primary" type="button" (click)="nova()">
          Nova categoria
        </button>
      }
    </header>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }
    @if (aviso()) {
      <jano-banner tone="good">{{ aviso() }}</jano-banner>
    }

    @if (faltam() > 0 && !form()) {
      <div class="sug">
        <jano-banner tone="info">
          Há {{ faltam() }} categorias sugeridas que você ainda não tem.
          <button
            janoButton
            variant="ghost"
            type="button"
            (click)="adicionarSugeridas()"
          >
            Adicionar
          </button>
        </jano-banner>
      </div>
    }

    @if (form(); as f) {
      <section
        class="j-card form"
        [attr.aria-label]="f.id ? 'Editar categoria' : 'Nova categoria'"
      >
        <h2 style="margin:0">
          {{ f.id ? 'Editar categoria' : 'Nova categoria' }}
        </h2>

        <div class="previa">
          <jano-category-badge
            [icon]="f.icon"
            [colorToken]="f.color"
            [size]="48"
          />
          <strong>{{ f.name || 'Nome da categoria' }}</strong>
        </div>

        <label class="j-field">
          <span class="j-field__label">Nome</span>
          <span class="j-input"
            ><input
              [value]="f.name"
              (input)="mudar('name', $any($event.target).value)"
              maxlength="40"
              aria-label="Nome da categoria"
          /></span>
        </label>

        <div class="j-field">
          <span class="j-field__label" id="tipo-rot">Tipo</span>
          <div class="tipos" role="group" aria-labelledby="tipo-rot">
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="f.type === 'despesa'"
              (click)="mudar('type', 'despesa')"
            >
              Despesa
            </button>
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="f.type === 'receita'"
              (click)="mudar('type', 'receita')"
            >
              Receita
            </button>
          </div>
        </div>

        <div class="j-field">
          <span class="j-field__label" id="cor-rot">Cor</span>
          <div class="cores" role="group" aria-labelledby="cor-rot">
            @for (c of cores; track c) {
              <button
                type="button"
                class="cor"
                [attr.aria-label]="'Cor ' + c.replace('cat-', '')"
                [attr.aria-pressed]="f.color === c"
                [style.background]="'var(--' + c + ')'"
                (click)="mudar('color', c)"
              ></button>
            }
          </div>
        </div>

        <div class="j-field">
          <span class="j-field__label" id="ico-rot">Ícone</span>
          <div class="icones" role="group" aria-labelledby="ico-rot">
            @for (i of icones; track i) {
              <button
                type="button"
                class="ico"
                [attr.aria-label]="rotulo(i)"
                [attr.title]="rotulo(i)"
                [attr.aria-pressed]="f.icon === i"
                (click)="mudar('icon', i)"
              >
                <jano-icon [name]="i" [size]="22" />
              </button>
            }
          </div>
        </div>

        <div class="rodape">
          <button
            janoButton
            variant="secondary"
            type="button"
            (click)="cancelar()"
          >
            Cancelar
          </button>
          <button
            janoButton
            variant="primary"
            type="button"
            [disabled]="ocupado()"
            (click)="salvar()"
          >
            Salvar
          </button>
        </div>
      </section>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando categorias">
        <jano-skeleton-rows [count]="8" />
      </jano-skeleton-group>
    }
    @for (grupo of grupos(); track grupo.titulo) {
      @if (grupo.itens.length) {
        <h2>{{ grupo.titulo }}</h2>
        <div class="lista">
          @for (c of grupo.itens; track c.id) {
            <div class="item">
              <jano-category-badge [icon]="c.icon" [colorToken]="c.color" />
              <span class="nome">{{ c.name }}</span>
              <span class="acoes">
                <button
                  janoButton
                  variant="ghost"
                  type="button"
                  [attr.aria-label]="'Editar ' + c.name"
                  (click)="editar(c)"
                >
                  Editar
                </button>
                <button
                  janoButton
                  variant="ghost"
                  type="button"
                  [attr.aria-label]="'Apagar ' + c.name"
                  (click)="pedirApagar(c)"
                >
                  Apagar
                </button>
              </span>
            </div>
            @if (apagando()?.id === c.id) {
              <div
                class="conf"
                role="alertdialog"
                [attr.aria-label]="'Confirmar exclusão de ' + c.name"
              >
                <span
                  >As transações de “{{ c.name }}” ficam sem categoria e a meta
                  dela é removida. Isso não pode ser desfeito.</span
                >
                <span style="display:flex;gap:8px">
                  <button
                    janoButton
                    variant="secondary"
                    type="button"
                    (click)="apagando.set(null)"
                  >
                    Cancelar
                  </button>
                  <button
                    janoButton
                    variant="danger"
                    type="button"
                    [disabled]="ocupado()"
                    (click)="apagar(c)"
                  >
                    Apagar
                  </button>
                </span>
              </div>
            }
          }
        </div>
      }
    }
  `,
})
export class Categorias {
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogRepository);

  protected readonly cores = CATEGORY_COLORS;
  protected readonly icones = ICON_NAMES;
  protected readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly form = signal<Form | null>(null);
  protected readonly apagando = signal<CategoryDoc | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  protected readonly aviso = signal('');

  protected readonly faltam = computed(
    () => missingDefaults(this.categorias()).length,
  );
  protected readonly grupos = computed(() => [
    {
      titulo: 'Despesas',
      itens: this.categorias().filter((c) => c.type === 'despesa'),
    },
    {
      titulo: 'Receitas',
      itens: this.categorias().filter((c) => c.type === 'receita'),
    },
  ]);

  constructor() {
    void this.carregar();
  }

  private get uid(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    return u.uid;
  }

  protected rotulo(icon: string): string {
    return ICONS[icon]?.label ?? icon;
  }

  private async carregar(): Promise<void> {
    try {
      this.categorias.set(await this.catalog.categories(this.uid));
    } catch (e) {
      this.falha(e);
    } finally {
      this.carregando.set(false);
    }
  }

  protected nova(): void {
    this.limpar();
    this.form.set({ ...NOVA });
  }

  protected editar(c: CategoryDoc): void {
    this.limpar();
    this.form.set({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      icon: c.icon,
    });
  }

  protected mudar<K extends keyof Form>(campo: K, valor: Form[K]): void {
    this.form.update((f) => (f ? { ...f, [campo]: valor } : f));
  }

  protected cancelar(): void {
    this.form.set(null);
  }

  protected async salvar(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.erro.set('');
    this.ocupado.set(true);
    try {
      const atual = this.categorias().find((c) => c.id === f.id);
      await this.catalog.saveCategory(
        this.uid,
        {
          id: f.id,
          name: f.name,
          type: f.type,
          color: f.color,
          icon: f.icon,
          position: atual?.position,
        },
        this.categorias(),
      );
      this.form.set(null);
      this.aviso.set(f.id ? 'Categoria atualizada.' : 'Categoria criada.');
      await this.carregar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected pedirApagar(c: CategoryDoc): void {
    this.limpar();
    this.apagando.set(c);
  }

  protected async apagar(c: CategoryDoc): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.catalog.deleteCategory(this.uid, c.id);
      this.apagando.set(null);
      this.aviso.set(`Categoria “${c.name}” apagada.`);
      await this.carregar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async adicionarSugeridas(): Promise<void> {
    this.limpar();
    try {
      const n = await this.catalog.addMissingDefaults(
        this.uid,
        this.categorias(),
      );
      this.aviso.set(`${n} categorias adicionadas.`);
      await this.carregar();
    } catch (e) {
      this.falha(e);
    }
  }

  private limpar(): void {
    this.erro.set('');
    this.aviso.set('');
    this.apagando.set(null);
  }

  private falha(e: unknown): void {
    this.erro.set(
      e instanceof Error ? e.message : 'Tente de novo em instantes.',
    );
  }
}
