import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { JanoSplash } from '@jano/ui';
import { lerContextoSplash, marcarSplashVista, splashDuracao } from './splash';

@Component({
  imports: [RouterOutlet, JanoSplash],
  selector: 'jano-root',
  template: `
    <router-outlet />
    @if (splash()) {
      <jano-splash />
    }
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly duracao = splashDuracao(lerContextoSplash());
  protected readonly splash = signal(this.duracao > 0);

  constructor() {
    if (this.duracao > 0) void this.encerrarSplash();
  }

  /** Some quando a animação terminou E a sessão do login foi restaurada. */
  private async encerrarSplash(): Promise<void> {
    await Promise.all([
      new Promise((r) => setTimeout(r, this.duracao)),
      this.auth.whenReady().catch(() => undefined),
    ]);
    marcarSplashVista();
    this.splash.set(false);
  }
}
