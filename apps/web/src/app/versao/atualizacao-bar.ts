import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JanoButton } from '@jano/ui';
import { AtualizacaoService } from './atualizacao.service';

/** Faixa fixa no rodapé quando há versão nova. */
@Component({
  selector: 'jano-atualizacao-bar',
  imports: [RouterLink, JanoButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .barra {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      max-width: calc(100vw - 32px);
      padding: 12px 16px;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
      font: 400 14px/20px var(--font-sans);
      color: var(--text);
    }
  `,
  template: `
    @if (svc.disponivel(); as v) {
      <div class="barra" role="status">
        <span
          ><b>Nova versão disponível</b>
          @if (v.version) {
            ({{ v.version }})
          }
        </span>
        <a janoButton variant="ghost" [small]="true" routerLink="/novidades"
          >Ver novidades</a
        >
        <button
          janoButton
          variant="primary"
          [small]="true"
          type="button"
          (click)="svc.atualizar()"
        >
          Atualizar
        </button>
      </div>
    }
  `,
})
export class AtualizacaoBar {
  protected readonly svc = inject(AtualizacaoService);
}
