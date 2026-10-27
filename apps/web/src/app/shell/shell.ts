import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '@jano/data-access';
import { JanoButton, JanoLogo } from '@jano/ui';
import { filter } from 'rxjs';
import { VERSAO_ATUAL } from '../versao/changelog';
import { haNovidades } from '../versao/novidades';

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
  { rota: '/categorias', rotulo: 'Categorias', d: 'M4 4H12L20 12L12 20L4 12Z' },
];

/** Telas previstas no protótipo que ainda não existem. */
const EM_BREVE: Omit<Item, 'rota'>[] = [
  { rotulo: 'Avaliações', d: 'M5 19V13M12 19V6M19 19V10' },
  { rotulo: 'Projeções', d: 'M4 18L9 12L13 15L20 6' },
  {
    rotulo: 'Recorrências',
    d: 'M4 12A8 8 0 0 1 18 7M20 12A8 8 0 0 1 6 17M18 3V7H14M6 21V17H10',
  },
];

/** Estrutura do app logado: menu lateral no desktop, barra de abas no celular. */
@Component({
  selector: 'jano-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, JanoButton, JanoLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
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
    .rodape .j-btn {
      justify-content: flex-start;
    }
    .nome {
      padding: 0 12px;
      font: 500 14px/20px var(--font-sans);
    }
    .versao {
      padding: 4px 12px 0;
    }
    .ponto {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-left: 6px;
      border-radius: 50%;
      background: var(--primary);
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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
      main {
        padding-bottom: 80px;
      }
    }
  `,
  template: `
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
        <div class="nome">{{ nome() }}</div>
        <a janoButton variant="ghost" [small]="true" routerLink="/novidades"
          >Novidades
          @if (novidades()) {
            <span class="ponto" aria-label="há novidades"></span>
          }
        </a>
        <button
          janoButton
          variant="ghost"
          [small]="true"
          type="button"
          (click)="sair()"
        >
          Sair
        </button>
        <span class="j-cap versao">Jano v{{ versao }}</span>
      </div>
    </aside>

    <header class="topo">
      <jano-logo [size]="26" />
      <span>
        <a janoButton variant="ghost" [small]="true" routerLink="/novidades"
          >Novidades
          @if (novidades()) {
            <span class="ponto" aria-label="há novidades"></span>
          }
        </a>
        <button
          janoButton
          variant="ghost"
          [small]="true"
          type="button"
          (click)="sair()"
        >
          Sair
        </button>
      </span>
    </header>

    <main><router-outlet /></main>

    <nav class="j-nav j-nav--bottom abas" aria-label="Principal">
      @for (i of itens; track i.rota) {
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
    </nav>
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly itens = ITENS;
  protected readonly emBreve = EM_BREVE;
  protected readonly versao = VERSAO_ATUAL;
  protected readonly novidades = signal(haNovidades());

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.novidades.set(haNovidades()));
  }

  protected nome(): string {
    return this.auth.user()?.displayName ?? '';
  }

  protected async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
