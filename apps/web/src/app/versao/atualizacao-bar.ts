import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AtualizacaoService } from './atualizacao.service';

/** Aviso flutuante de versão nova: o que mudou, e atualizar com retorno imediato. */
@Component({
  selector: 'jano-atualizacao-bar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .aviso {
      position: fixed;
      left: 50%;
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      z-index: 50;
      width: min(440px, calc(100vw - 32px));
      box-sizing: border-box;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 4px 12px;
      padding: 14px 14px 12px 16px;
      background: var(--brand-deep);
      color: var(--on-brand);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sheet);
      font-family: var(--font-sans);
    }
    @media (prefers-reduced-motion: no-preference) {
      .aviso {
        animation: subir 220ms ease-out;
      }
      @keyframes subir {
        from {
          opacity: 0;
          transform: translate(-50%, 12px);
        }
      }
    }
    @media (max-width: 899px) {
      .aviso {
        bottom: calc(88px + env(safe-area-inset-bottom, 0px));
      }
    }
    .icone {
      grid-row: span 2;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--on-brand) 14%, transparent);
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .titulo {
      font: 600 15px/20px var(--font-sans);
      align-self: center;
    }
    .texto {
      font: 400 13px/18px var(--font-sans);
      color: var(--on-brand-2);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .acoes {
      grid-column: 2;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 6px;
    }
    .acoes a,
    .acoes .depois {
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--on-brand-2);
      font: 500 14px/20px var(--font-sans);
      text-decoration: none;
      cursor: pointer;
    }
    .atualizar {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 112px;
      justify-content: center;
      padding: 8px 14px;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--on-brand);
      color: var(--brand-deep);
      font: 600 14px/20px var(--font-sans);
      cursor: pointer;
    }
    .atualizar:disabled {
      cursor: progress;
      opacity: 0.85;
    }
    .aviso button:focus-visible,
    .aviso a:focus-visible {
      outline: 2px solid var(--on-brand);
      outline-offset: 2px;
    }
    .gira {
      animation: girar 0.8s linear infinite;
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .gira {
        animation: none;
      }
    }
  `,
  template: `
    @if (visivel(); as v) {
      <div class="aviso" role="status" aria-live="polite">
        <span class="icone" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </span>
        <div class="titulo">
          {{
            v.version
              ? 'Versão ' + v.version + ' disponível'
              : 'Versão nova disponível'
          }}
        </div>
        <div class="texto">{{ texto() }}</div>
        <div class="acoes">
          @if (svc.estado() !== 'aplicando') {
            <a routerLink="/novidades">Novidades</a>
            <button class="depois" type="button" (click)="svc.dispensar()">
              Depois
            </button>
          }
          <button
            class="atualizar"
            type="button"
            [disabled]="svc.estado() === 'aplicando'"
            (click)="svc.atualizar()"
          >
            @if (svc.estado() === 'aplicando') {
              <svg
                class="gira"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.22-8.56" />
              </svg>
              Atualizando…
            } @else {
              Atualizar
            }
          </button>
        </div>
      </div>
    }
  `,
})
export class AtualizacaoBar {
  protected readonly svc = inject(AtualizacaoService);

  protected readonly visivel = computed(() => {
    const v = this.svc.disponivel();
    return v && this.svc.dispensada() !== v.buildId ? v : null;
  });

  protected readonly texto = computed(() => {
    const estado = this.svc.estado();
    if (estado === 'aplicando')
      return 'Instalando e recarregando, leva só um instante.';
    const novidade = this.svc.disponivel()?.novidade;
    const pronto =
      estado === 'pronta'
        ? 'Pronta para instalar.'
        : 'Baixando em segundo plano…';
    return novidade ? `${novidade}` : pronto;
  });
}
