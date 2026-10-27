import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { JanoButton } from '@jano/ui';

@Component({
  selector: 'jano-inicio',
  imports: [JanoButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: 24px 16px;
    }
    h1 {
      font: 600 28px/36px var(--font-sans);
      margin: 0 0 8px;
    }
    p {
      color: var(--text-2);
      margin: 0 0 24px;
    }
  `,
  template: `
    <h1>Olá, {{ nome() }}</h1>
    <p>Seu mês aparece aqui assim que você importar o primeiro extrato.</p>
    <button janoButton variant="secondary" type="button" (click)="sair()">
      Sair
    </button>
  `,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected nome(): string {
    return this.auth.user()?.displayName?.split(' ')[0] ?? '';
  }

  protected async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
