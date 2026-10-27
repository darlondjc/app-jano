import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { JanoBanner, JanoButton } from '@jano/ui';

@Component({
  selector: 'jano-entrar',
  imports: [JanoButton, JanoBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      min-height: 100dvh;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
    }
    main {
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    h1 {
      margin: 0;
      font: 600 32px/40px var(--font-sans);
      letter-spacing: -0.01em;
    }
    p {
      margin: 8px 0 0;
      color: var(--text-2);
      font: 400 16px/24px var(--font-sans);
    }
    small {
      color: var(--text-2);
      font: 400 12px/16px var(--font-sans);
    }
    button {
      width: 100%;
      height: 52px;
    }
  `,
  template: `
    <main>
      <div>
        <h1>Entre no Jano</h1>
        <p>Use sua conta Google. Você não precisa criar outra senha.</p>
      </div>
      @if (erro()) {
        <jano-banner tone="danger" title="Não foi possível entrar.">
          O login com o Google foi cancelado ou expirou. Nada foi alterado na
          sua conta.
        </jano-banner>
      }
      <button
        janoButton
        variant="secondary"
        type="button"
        [disabled]="carregando()"
        (click)="entrar()"
      >
        {{
          carregando()
            ? 'Abrindo o Google...'
            : erro()
              ? 'Tentar de novo com o Google'
              : 'Continuar com Google'
        }}
      </button>
      <small>Você será levado ao Google e volta para cá em seguida.</small>
    </main>
  `,
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected async entrar(): Promise<void> {
    this.erro.set(false);
    this.carregando.set(true);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/');
    } catch {
      this.erro.set(true);
    } finally {
      this.carregando.set(false);
    }
  }
}
