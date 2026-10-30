import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';

type Fase = 'oculto' | 'carregando' | 'concluindo';

/**
 * Barra fina de progresso fixada no topo da janela (acima do cabeçalho).
 * Avança sozinha enquanto `ativo` for verdadeiro e completa ao ficar falso.
 */
@Component({
  selector: 'jano-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 100;
      pointer-events: none;
    }
    .barra {
      height: 100%;
      width: 0;
      background: var(--primary);
      border-radius: 0 2px 2px 0;
      opacity: 0;
    }
    .carregando {
      width: 85%;
      opacity: 1;
      transition: width 8s cubic-bezier(0.1, 0.6, 0.2, 1);
    }
    .concluindo {
      width: 100%;
      opacity: 0;
      transition:
        width 200ms ease-out,
        opacity 300ms ease 150ms;
    }
    @media (prefers-reduced-motion: reduce) {
      .carregando,
      .concluindo {
        transition: none;
      }
    }
  `,
  template: `<div
    class="barra"
    [class]="fase()"
    role="progressbar"
    aria-label="Carregando"
    [attr.aria-hidden]="fase() === 'oculto' ? 'true' : null"
  ></div>`,
})
export class JanoProgressBar {
  readonly ativo = input(false);
  protected readonly fase = signal<Fase>('oculto');

  constructor() {
    effect((onCleanup) => {
      if (this.ativo()) {
        this.fase.set('carregando');
        return;
      }
      if (this.fase() === 'carregando') {
        this.fase.set('concluindo');
        const t = setTimeout(() => this.fase.set('oculto'), 500);
        onCleanup(() => clearTimeout(t));
      }
    });
  }
}
