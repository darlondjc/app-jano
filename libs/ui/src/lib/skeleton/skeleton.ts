import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Esqueletos de carregamento: blocos `j-skel` na forma exata do conteúdo, sem animação.
 * Padrão das telas: enquanto os dados chegam, mostre o esqueleto dentro de um
 * `<jano-skeleton-group>` (que avisa os leitores de tela) e troque pelo conteúdo real.
 */

/** Um bloco cinza. `circle` faz um círculo de lado `h`. */
@Component({
  selector: 'jano-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'j-skel',
    'aria-hidden': 'true',
    '[style.width]': 'largura()',
    '[style.height]': 'h()',
    '[style.border-radius]': 'circle() ? "50%" : null',
  },
  styles: `
    :host {
      display: block;
      flex: none;
      max-width: 100%;
    }
  `,
  template: '',
})
export class JanoSkeleton {
  readonly w = input('100%');
  readonly h = input('16px');
  readonly circle = input(false);
  protected readonly largura = computed(() =>
    this.circle() ? this.h() : this.w(),
  );
}

/** Região que está carregando: `aria-busy` e um texto só para leitores de tela. */
@Component({
  selector: 'jano-skeleton-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-busy': 'true', style: 'display: block' },
  template: `<span class="j-sr">{{ label() }}</span
    ><ng-content />`,
})
export class JanoSkeletonGroup {
  readonly label = input('Carregando…');
}

/** Cartão de indicador: rótulo, valor grande e legenda. */
@Component({
  selector: 'jano-skeleton-kpi',
  imports: [JanoSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <div class="j-card j-kpi" style="height: 100%" aria-hidden="true">
      <jano-skeleton w="45%" h="14px" />
      <jano-skeleton w="70%" h="32px" />
      <jano-skeleton w="85%" h="12px" />
    </div>
  `,
})
export class JanoSkeletonKpi {}

/** Cartão com título e uma área de conteúdo (gráfico, tabela…). */
@Component({
  selector: 'jano-skeleton-card',
  imports: [JanoSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    <div class="j-card" aria-hidden="true">
      <jano-skeleton w="40%" h="20px" />
      <jano-skeleton w="65%" h="14px" style="margin: 10px 0 16px" />
      <jano-skeleton [h]="altura()" />
    </div>
  `,
})
export class JanoSkeletonCard {
  readonly altura = input('220px');
}

/** Linhas de lista: círculo, dois textos e um valor à direita (como `j-tx`). */
@Component({
  selector: 'jano-skeleton-rows',
  imports: [JanoSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  styles: `
    .linha {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .linha:last-child {
      border-bottom: 0;
    }
    .textos {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .caixa {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
  `,
  template: `
    <div class="caixa" aria-hidden="true">
      @for (n of linhas(); track n) {
        <div class="linha">
          <jano-skeleton h="32px" [circle]="true" />
          <div class="textos">
            <jano-skeleton [w]="n % 2 ? '55%' : '40%'" h="14px" />
            <jano-skeleton [w]="n % 2 ? '30%' : '25%'" h="12px" />
          </div>
          <jano-skeleton w="72px" h="16px" />
        </div>
      }
    </div>
  `,
})
export class JanoSkeletonRows {
  readonly count = input(6);
  protected readonly linhas = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );
}

/** Barras de meta: nome e percentual, barra e texto de apoio. */
@Component({
  selector: 'jano-skeleton-goals',
  imports: [JanoSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  styles: `
    .meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .topo {
      display: flex;
      justify-content: space-between;
    }
  `,
  template: `
    <div aria-hidden="true">
      @for (n of linhas(); track n) {
        <div class="meta">
          <div class="topo">
            <jano-skeleton w="30%" h="16px" />
            <jano-skeleton w="40px" h="16px" />
          </div>
          <jano-skeleton h="12px" />
          <jano-skeleton w="60%" h="12px" />
        </div>
      }
    </div>
  `,
})
export class JanoSkeletonGoals {
  readonly count = input(4);
  protected readonly linhas = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );
}
