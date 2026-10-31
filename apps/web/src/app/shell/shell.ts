import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { definirModoDemo, modoDemoAtivo } from '@jano/data-access';
import { JanoBackToTop, JanoLogo, JanoProgressBar } from '@jano/ui';
import { VERSAO_ATUAL } from '../versao/changelog';
import { haNovidades } from '../versao/novidades';
import { AvatarMenu } from './avatar-menu';
import { AvisoConexaoBanner } from './aviso-conexao-banner';
import { Progresso } from './progresso';

interface Item {
  rota: string;
  rotulo: string;
  /** Caminho do ícone (viewBox 24, traço). */
  d: string;
  exato?: boolean;
}

const ITENS: Item[] = [
  {
    rota: '/',
    rotulo: 'Início',
    d: 'M4 11L12 4L20 11V20H14V14H10V20H4Z',
    exato: true,
  },
  { rota: '/transacoes', rotulo: 'Transações', d: 'M4 7H20M4 12H20M4 17H14' },
  {
    rota: '/orcamento',
    rotulo: 'Orçamento',
    d: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M12 4V12H20',
  },
  {
    rota: '/avaliacoes',
    rotulo: 'Avaliações',
    d: 'M5 19V13M12 19V6M19 19V10',
  },
  {
    rota: '/projecoes',
    rotulo: 'Projeções',
    d: 'M4 18L9 12L13 15L20 6',
  },
  {
    rota: '/recorrencias',
    rotulo: 'Recorrências',
    d: 'M4 12A8 8 0 0 1 18 7M20 12A8 8 0 0 1 6 17M18 3V7H14M6 21V17H10',
  },
  { rota: '/categorias', rotulo: 'Categorias', d: 'M4 4H12L20 12L12 20L4 12Z' },
];

/** Abas do celular: as quatro principais e "Mais" com o resto. */
const PRINCIPAIS = ['/', '/transacoes', '/orcamento', '/projecoes'];
const MAIS_EXTRAS: Item[] = [
  {
    rota: '/conta',
    rotulo: 'Conta e dados',
    d: 'M12 12a4 4 0 1 0 0 -8a4 4 0 0 0 0 8M4 20a8 8 0 0 1 16 0',
  },
  { rota: '/novidades', rotulo: 'Novidades', d: 'M12 4V13M12 18V18.5' },
];

/** Telas previstas no protótipo que ainda não existem (nenhuma por enquanto). */
const EM_BREVE: Omit<Item, 'rota'>[] = [];

/** Estrutura do app logado: menu lateral no desktop, barra de abas no celular. */
@Component({
  selector: 'jano-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    JanoLogo,
    AvatarMenu,
    AvisoConexaoBanner,
    JanoProgressBar,
    JanoBackToTop,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Modo demonstração: chip no centro do cabeçalho; tocar sai do modo. */
    .chip-demo {
      justify-self: center;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 10px 0 12px;
      border: 1px solid var(--info);
      border-radius: var(--radius-pill);
      background: var(--info-soft);
      color: var(--info);
      font: 600 13px/1 var(--font-sans);
      cursor: pointer;
    }
    .chip-demo svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .chip-demo:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    :host {
      display: flex;
      min-height: 100vh;
      background: var(--bg);
    }
    .lado {
      position: sticky;
      top: 0;
      align-self: flex-start;
      height: 100vh;
      flex: 0 0 240px;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-right: 1px solid var(--border);
    }
    .marca {
      text-decoration: none;
      color: inherit;
      display: inline-flex;
      padding: 24px 16px 8px 20px;
    }
    .lado nav {
      border-right: 0;
      width: auto;
    }
    .breve {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      padding: 0 12px;
      color: var(--text-2);
      opacity: 0.6;
      font: 500 14px/20px var(--font-sans);
      cursor: default;
    }
    .breve small {
      margin-left: auto;
      font: 500 11px/16px var(--font-sans);
    }
    .rodape {
      margin-top: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-top: 1px solid var(--border);
    }
    .versao {
      padding: 0 12px;
    }
    .topo-largo {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding: 12px 24px 0;
    }
    .topo-largo jano-avatar-menu,
    .topo jano-avatar-menu {
      justify-self: end;
      grid-column: 3;
    }
    .topo jano-logo {
      justify-self: start;
    }
    main {
      flex: 1 1 0;
      min-width: 0;
    }
    .topo,
    .abas {
      display: none;
    }
    @media (max-width: 899px) {
      :host {
        flex-direction: column;
      }
      .lado {
        display: none;
      }
      .topo {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 12px 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
      }
      .abas {
        display: flex;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 40;
      }
      .topo-largo {
        display: none;
      }
      main {
        padding-bottom: 80px;
      }
    }
    .mais-fundo {
      position: fixed;
      inset: 0;
      z-index: 41;
      border: 0;
      background: var(--overlay);
      cursor: default;
    }
    .mais {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 84px;
      z-index: 42;
      padding: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sheet);
    }
    .mais a,
    .mais .breve {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      color: var(--text);
      text-decoration: none;
      font: 500 15px/20px var(--font-sans);
    }
    .mais a[aria-current='page'] {
      color: var(--primary-text);
      background: var(--primary-soft);
    }
    .mais .breve {
      color: var(--text-2);
      opacity: 0.6;
    }
    .mais .breve small {
      margin-left: auto;
      font: 500 11px/16px var(--font-sans);
    }
    .ponto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
    }
    button.j-nav__item {
      border: 0;
      background: none;
      cursor: pointer;
      font-family: inherit;
    }
  `,
  template: `
    <jano-progress-bar [ativo]="progresso.ativo()" />
    <aside class="lado">
      <a class="marca" routerLink="/" aria-label="Jano, início">
        <jano-logo [size]="30" />
      </a>
      <nav class="j-nav j-nav--side" aria-label="Principal">
        @for (i of itens; track i.rota) {
          <a
            class="j-nav__item"
            [routerLink]="i.rota"
            routerLinkActive
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: !!i.exato }"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                [attr.d]="i.d"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ i.rotulo }}
          </a>
        }
        @for (i of emBreve; track i.rotulo) {
          <span class="breve" aria-disabled="true">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                [attr.d]="i.d"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ i.rotulo }}
            <small>em breve</small>
          </span>
        }
      </nav>
      <div class="rodape">
        <span class="j-cap versao">Jano v{{ versao }}</span>
      </div>
    </aside>

    <header class="topo">
      <jano-logo [size]="26" />
      @if (demo) {
        <button
          class="chip-demo"
          type="button"
          title="Sair da demonstração"
          aria-label="Modo demonstração, com dados fictícios. Sair da demonstração"
          (click)="sairDaDemo()"
        >
          Demonstração
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      }
      <jano-avatar-menu [novidades]="novidades()" />
    </header>

    <main>
      <div class="topo-largo">
        <span></span>
        @if (demo) {
          <button
            class="chip-demo"
            type="button"
            title="Sair da demonstração"
            aria-label="Modo demonstração, com dados fictícios. Sair da demonstração"
            (click)="sairDaDemo()"
          >
            Demonstração
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        }
        <jano-avatar-menu [novidades]="novidades()" />
      </div>
      @if (!demo) {
        <jano-aviso-conexao />
      }
      <router-outlet />
    </main>

    <nav class="j-nav j-nav--bottom abas" aria-label="Principal">
      @for (i of principais; track i.rota) {
        <a
          class="j-nav__item"
          [routerLink]="i.rota"
          routerLinkActive
          ariaCurrentWhenActive="page"
          [routerLinkActiveOptions]="{ exact: !!i.exato }"
        >
          <span class="j-nav__ic">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                [attr.d]="i.d"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          {{ i.rotulo }}
        </a>
      }
      <button
        class="j-nav__item"
        type="button"
        aria-haspopup="menu"
        [attr.aria-expanded]="maisAberto()"
        [attr.aria-current]="maisAtivo() ? 'page' : null"
        (click)="maisAberto.set(!maisAberto())"
      >
        <span class="j-nav__ic">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12H5.01M12 12H12.01M19 12H19.01"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        </span>
        Mais
      </button>
    </nav>
    @if (maisAberto()) {
      <button
        class="mais-fundo"
        type="button"
        aria-label="Fechar menu"
        (click)="maisAberto.set(false)"
      ></button>
      <div class="mais" role="menu" aria-label="Mais">
        @for (i of maisItens; track i.rota) {
          <a
            role="menuitem"
            [routerLink]="i.rota"
            routerLinkActive
            ariaCurrentWhenActive="page"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                [attr.d]="i.d"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ i.rotulo }}
            @if (i.rota === '/novidades' && novidades()) {
              <span class="ponto" aria-label="há novidades"></span>
            }
          </a>
        }
        @for (i of emBreve; track i.rotulo) {
          <span class="breve" aria-disabled="true">
            {{ i.rotulo }}<small>em breve</small>
          </span>
        }
      </div>
    }
    <jano-back-to-top />
  `,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly demo = modoDemoAtivo();
  protected sairDaDemo(): void {
    definirModoDemo(false);
  }
  protected readonly progresso = inject(Progresso);

  protected readonly itens = ITENS;
  protected readonly principais = ITENS.filter((i) =>
    PRINCIPAIS.includes(i.rota),
  );
  protected readonly maisItens = [
    ...ITENS.filter((i) => !PRINCIPAIS.includes(i.rota)),
    ...MAIS_EXTRAS,
  ];
  protected readonly maisAberto = signal(false);
  private readonly url = signal(this.router.url);
  protected readonly maisAtivo = computed(() =>
    this.maisItens.some((i) => this.url().startsWith(i.rota)),
  );
  protected readonly emBreve = EM_BREVE;
  protected readonly versao = VERSAO_ATUAL;
  protected readonly novidades = signal(haNovidades());

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationStart) this.progresso.iniciar();
      else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError ||
        e instanceof NavigationSkipped
      )
        this.progresso.concluir();
      if (e instanceof NavigationEnd) {
        this.novidades.set(haNovidades());
        this.url.set(e.urlAfterRedirects);
        this.maisAberto.set(false);
      }
    });
  }
}
