import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Seletor de mês: rótulo centralizado entre setas de anterior e próximo. Sem `navegavel`
 * (ex.: período de vários meses), as setas somem e o rótulo fica no mesmo lugar.
 */
@Component({
  selector: 'jano-month-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fixo]': '!navegavel()' },
  styles: `
    :host {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) 40px;
      align-items: center;
      width: 100%;
      max-width: 360px;
      height: 44px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin: 0 2px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-2);
      cursor: pointer;
    }
    button:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    :host(.fixo) button {
      visibility: hidden;
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .rotulo {
      color: var(--text);
      text-align: center;
      font: 600 16px/24px var(--font-sans);
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
  `,
  template: `
    <button
      type="button"
      aria-label="Mês anterior"
      [disabled]="!navegavel()"
      (click)="anterior.emit()"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <span class="rotulo" aria-live="polite">{{ rotulo() }}</span>
    <button
      type="button"
      aria-label="Próximo mês"
      [disabled]="!navegavel()"
      (click)="proximo.emit()"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  `,
})
export class JanoMonthNav {
  readonly rotulo = input.required<string>();
  readonly navegavel = input(true);
  readonly anterior = output<void>();
  readonly proximo = output<void>();
}
