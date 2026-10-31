import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, definirModoDemo } from '@jano/data-access';
import { JanoBanner, JanoButton, JanoLogo } from '@jano/ui';

@Component({
  selector: 'jano-entrar',
  imports: [JanoBanner, JanoButton, JanoLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
    }
    aside {
      display: none;
      flex: 1 1 560px;
      background: var(--primary);
      color: var(--on-primary);
      padding: 64px;
      flex-direction: column;
      justify-content: space-between;
    }
    aside h2 {
      margin: 0;
      font: 600 48px/56px var(--font-sans);
      letter-spacing: -0.02em;
      color: #fff;
      max-width: 520px;
    }
    aside p {
      margin: 16px 0 0;
      font: 400 18px/28px var(--font-sans);
      color: #fff;
      opacity: 0.92;
      max-width: 480px;
    }
    aside small {
      font: 400 14px/20px var(--font-sans);
      color: #fff;
      opacity: 0.92;
    }
    main {
      flex: 1 1 480px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 72px 24px 24px;
    }
    .corpo {
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
      letter-spacing: -0.01em;
    }
    .sub {
      margin: 8px 0 0;
      color: var(--text-2);
      font: 400 16px/24px var(--font-sans);
    }
    .gbtn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      height: 52px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text);
      font: 500 16px/24px var(--font-sans);
      cursor: pointer;
    }
    .gbtn:hover {
      background: var(--surface-2);
    }
    .gbtn:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .gbtn[disabled] {
      cursor: progress;
      opacity: 0.8;
    }
    .gmark {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid var(--border-strong);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: 600 13px/1 var(--font-sans);
    }
    .spin {
      animation: jspin 0.9s linear infinite;
      transform-origin: center;
    }
    @keyframes jspin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .cap {
      color: var(--text-2);
      font: 400 12px/16px var(--font-sans);
    }
    .grupo {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .nota {
      display: flex;
      gap: 12px;
      padding: 16px;
      border-radius: var(--radius-md);
      background: var(--surface-2);
      color: var(--text-2);
      font: 400 14px/20px var(--font-sans);
    }
    .nota svg {
      flex: none;
      color: var(--primary-text);
      margin-top: 2px;
    }
    .logo-mobile {
      display: block;
    }
    footer {
      padding-top: 24px;
      text-align: center;
    }
    @media (min-width: 960px) {
      aside {
        display: flex;
      }
      .logo-mobile {
        display: none;
      }
      main {
        justify-content: center;
        padding: 64px 48px;
      }
      footer {
        padding-top: 32px;
      }
      h1 {
        font-size: 32px;
        line-height: 40px;
      }
    }
  `,
  template: `
    <aside>
      <jano-logo tone="light" [size]="42" />
      <div>
        <h2>Veja o que passou. Planeje o que vem.</h2>
        <p>
          Suas transações, metas e projeções em um só lugar, no celular e no
          computador.
        </p>
      </div>
      <small>O Jano só lê os dados que você envia. Nunca move dinheiro.</small>
    </aside>

    <main>
      <div class="corpo">
        <jano-logo class="logo-mobile" [size]="38" />
        <div>
          <h1>Entre no Jano</h1>
          <p class="sub">
            Use sua conta Google. Você não precisa criar outra senha.
          </p>
        </div>

        @if (erro()) {
          <jano-banner tone="danger" title="Não foi possível entrar.">{{
            erro()
          }}</jano-banner>
        }

        <div class="grupo">
          <button
            class="gbtn"
            type="button"
            [disabled]="carregando()"
            (click)="entrar()"
          >
            @if (carregando()) {
              <svg
                class="spin"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  style="stroke: var(--border)"
                  stroke-width="3"
                />
                <path
                  d="M12 3A9 9 0 0 1 21 12"
                  fill="none"
                  style="stroke: var(--primary)"
                  stroke-width="3"
                  stroke-linecap="round"
                />
              </svg>
              Abrindo o Google...
            } @else {
              <span class="gmark" aria-hidden="true">G</span>
              {{
                erro() ? 'Tentar de novo com o Google' : 'Continuar com Google'
              }}
            }
          </button>
          <span class="cap" style="text-align: center"
            >Você será levado ao Google e volta para cá em seguida.</span
          >
          <button
            janoButton
            variant="ghost"
            type="button"
            (click)="demonstracao()"
          >
            Ver com dados de demonstração
          </button>
        </div>

        <div class="nota">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="5"
              y="11"
              width="14"
              height="9"
              rx="2"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M8 11V8A4 4 0 0 1 16 8V11"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
          <div>
            O Jano só lê os dados que você envia. Nunca move dinheiro e nunca
            pede a senha do banco.
          </div>
        </div>
      </div>
      <footer>
        <p class="cap" style="margin: 0">
          Seus dados ficam na sua conta e só você os acessa.
        </p>
      </footer>
    </main>
  `,
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');

  /** Abre o app com dados fictícios, sem login nem servidor. */
  protected demonstracao(): void {
    definirModoDemo(true);
  }

  protected async entrar(): Promise<void> {
    this.erro.set('');
    this.carregando.set(true);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }
}

/** Traduz os códigos do Firebase Auth para mensagens claras, sem detalhes técnicos. */
export function mensagemDeErro(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'O login com o Google foi cancelado. Nada foi alterado na sua conta.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.';
    case 'auth/network-request-failed':
      return 'Sem conexão com o Google. Verifique a internet e tente de novo.';
    case 'auth/unauthorized-domain':
      return 'Este endereço ainda não foi autorizado no Firebase.';
    default:
      return 'O login com o Google não funcionou. Nada foi alterado na sua conta.';
  }
}
