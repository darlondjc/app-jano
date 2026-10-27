import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JanoButton } from '@jano/ui';
import { CHANGELOG, VERSAO_ATUAL, type TipoMudanca } from './changelog';

const ULTIMA_VISTA = 'jano.novidades.vista';

export function haNovidades(): boolean {
  try {
    return localStorage.getItem(ULTIMA_VISTA) !== VERSAO_ATUAL;
  } catch {
    return false;
  }
}

const ROTULO: Record<TipoMudanca, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
};

@Component({
  selector: 'jano-novidades',
  imports: [RouterLink, JanoButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    h1 {
      margin: 0 0 4px;
      font: 600 28px/36px var(--font-sans);
    }
    section {
      margin-top: 24px;
    }
    h2 {
      margin: 0 0 8px;
      font: 600 18px/24px var(--font-sans);
    }
    h2 small {
      font: 400 14px/20px var(--font-sans);
      color: var(--text-2);
      margin-left: 8px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    li {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    li:last-child {
      border-bottom: 0;
    }
    .tag {
      flex: none;
      min-width: 72px;
      font: 500 12px/20px var(--font-sans);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--primary-text);
    }
  `,
  template: `
    <a janoButton variant="ghost" [small]="true" routerLink="/">‹ Início</a>
    <h1>Novidades</h1>
    <div class="j-sub">Você está na versão {{ atual }}.</div>
    @for (v of versoes; track v.version) {
      <section>
        <h2>
          Versão {{ v.version }}
          @if (v.date) {
            <small>{{ dataBr(v.date) }}</small>
          }
        </h2>
        <ul>
          @for (i of v.items; track i.texto) {
            <li>
              <span class="tag">{{ rotulo[i.tipo] }}</span
              ><span>{{ i.texto }}</span>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class Novidades {
  protected readonly versoes = CHANGELOG;
  protected readonly atual = VERSAO_ATUAL;
  protected readonly rotulo = ROTULO;

  constructor() {
    try {
      localStorage.setItem(ULTIMA_VISTA, VERSAO_ATUAL);
    } catch {
      // Navegação privada: só não lembra que já viu.
    }
  }

  protected dataBr(iso: string): string {
    return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }
}
