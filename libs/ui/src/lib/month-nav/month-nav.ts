import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Atalho de período no menu do rótulo ("Este mês", "Últimos 3 meses"...). */
export interface OpcaoPeriodo {
  id: string;
  rotulo: string;
  ativo: boolean;
}

/**
 * Seletor de mês: rótulo centralizado entre setas de anterior e próximo. Sem `navegavel`
 * (ex.: período de vários meses), as setas somem e o rótulo fica no mesmo lugar. Com
 * `opcoes`, tocar no rótulo abre um menu de atalhos de período.
 */
@Component({
  selector: 'jano-month-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fixo]': '!navegavel()' },
  styles: `
    :host {
      position: relative;
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
      border: 0;
      background: transparent;
      cursor: pointer;
      font: inherit;
    }
    .seta {
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
    :host(.fixo) .seta {
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
    button.rotulo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      justify-self: center;
      max-width: 100%;
      border-radius: var(--radius-sm);
      gap: 4px;
      min-width: 0;
      height: 36px;
      padding: 0 10px;
    }
    button.rotulo span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button.rotulo svg {
      flex: none;
      color: var(--text-2);
    }
    .menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      min-width: 220px;
      padding: 6px;
      margin: 0;
      list-style: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-popover);
    }
    .menu button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 40px;
      margin: 0;
      padding: 0 12px;
      color: var(--text);
      font: 500 15px/20px var(--font-sans);
    }
    .menu button[aria-checked='true'] {
      color: var(--primary-text);
      font-weight: 600;
    }
  `,
  template: `
    <button
      class="seta"
      type="button"
      aria-label="Mês anterior"
      [disabled]="!navegavel()"
      (click)="anterior.emit()"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    @if (opcoes().length) {
      <button
        class="rotulo"
        type="button"
        aria-haspopup="menu"
        [attr.aria-expanded]="aberto()"
        [attr.aria-label]="rotulo() + ', escolher período'"
        (click)="aberto.set(!aberto())"
      >
        <span aria-live="polite">{{ rotulo() }}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      @if (aberto()) {
        <ul class="menu" role="menu">
          @for (o of opcoes(); track o.id) {
            <li role="none">
              <button
                type="button"
                role="menuitemradio"
                [attr.aria-checked]="o.ativo"
                (click)="escolher(o.id)"
              >
                {{ o.rotulo }}
                @if (o.ativo) {
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                }
              </button>
            </li>
          }
        </ul>
      }
    } @else {
      <span class="rotulo" aria-live="polite">{{ rotulo() }}</span>
    }
    <button
      class="seta"
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
  readonly opcoes = input<OpcaoPeriodo[]>([]);
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  readonly opcao = output<string>();

  protected readonly aberto = signal(false);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected escolher(id: string): void {
    this.aberto.set(false);
    this.opcao.emit(id);
  }

  @HostListener('document:click', ['$event'])
  protected fora(ev: Event): void {
    if (this.aberto() && !this.el.nativeElement.contains(ev.target as Node))
      this.aberto.set(false);
  }

  @HostListener('document:keydown.escape')
  protected esc(): void {
    this.aberto.set(false);
  }
}
