import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  signal,
} from '@angular/core';

/** Botão flutuante que leva ao topo da página; aparece depois de rolar um pouco. */
@Component({
  selector: 'jano-back-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: fixed;
      right: 16px;
      bottom: var(--jano-fab-bottom, 24px);
      z-index: 45;
    }
    button {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
      color: var(--on-primary, #fff);
      background: var(--primary);
      box-shadow: var(--shadow-sheet);
      transition:
        opacity 150ms ease,
        transform 150ms ease;
    }
    button:hover {
      background: var(--primary-hover, var(--primary));
    }
    button:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }
    button.oculto {
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
    }
    @media (max-width: 899px) {
      :host {
        --jano-fab-bottom: 88px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
  template: `
    <button
      type="button"
      [class.oculto]="!visivel()"
      [attr.tabindex]="visivel() ? null : -1"
      [attr.aria-hidden]="visivel() ? null : 'true'"
      aria-label="Voltar ao topo"
      (click)="subir()"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 19V5M5 12L12 5L19 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  `,
})
export class JanoBackToTop {
  /** Distância rolada (px) a partir da qual o botão aparece. */
  readonly aPartirDe = input(400);
  protected readonly visivel = signal(false);

  @HostListener('window:scroll')
  protected aoRolar(): void {
    this.visivel.set(window.scrollY > this.aPartirDe());
  }

  protected subir(): void {
    const reduzir = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
  }
}
