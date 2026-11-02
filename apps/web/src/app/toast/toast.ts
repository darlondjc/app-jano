import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
  signal,
} from '@angular/core';

/** Confirmação curta depois de uma ação ("Categoria alterada para Mercado."). Some em 5 s. */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly texto = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  mostrar(texto: string, ms = 5000): void {
    clearTimeout(this.timer);
    this.texto.set(texto);
    this.timer = setTimeout(() => this.texto.set(''), ms);
  }

  fechar(): void {
    clearTimeout(this.timer);
    this.texto.set('');
  }
}

/** Onde o toast aparece: flutuando acima da barra de abas (no celular) ou no pé da tela. */
@Component({
  selector: 'jano-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: fixed;
      left: 50%;
      bottom: calc(24px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      z-index: 70;
      width: min(440px, calc(100vw - 32px));
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    @media (max-width: 899px) {
      :host {
        bottom: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
    .j-toast {
      max-width: 100%;
      box-sizing: border-box;
    }
    .j-toast svg {
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    @media (prefers-reduced-motion: no-preference) {
      .j-toast {
        animation: subir 200ms ease-out;
      }
      @keyframes subir {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    }
  `,
  template: `
    <div aria-live="polite" role="status">
      @if (toast.texto(); as t) {
        <div class="j-toast">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{{ t }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toast = inject(Toast);
}
