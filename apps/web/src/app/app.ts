import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { JanoSplash } from '@jano/ui';
import { AtualizacaoBar } from './versao/atualizacao-bar';
import { AtualizacaoService } from './versao/atualizacao.service';
import { lerContextoSplash, marcarSplashVista, splashDuracao } from './splash';

@Component({
  imports: [RouterOutlet, JanoSplash, AtualizacaoBar],
  selector: 'jano-root',
  template: `
    <router-outlet />
    <jano-atualizacao-bar />
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
    inject(AtualizacaoService).iniciar();
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
