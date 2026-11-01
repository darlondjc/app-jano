import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type JanoButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Botão do design system. Uso: <button janoButton variant="primary">Salvar</button>
 *
 * Ações que demoram: `[carregando]="salvando()"` mostra o indicador girando, troca o texto
 * por `textoCarregando` ("Salvando…") e bloqueia novos toques até terminar.
 */
@Component({
  // Componente de atributo em <button>/<a>: preserva a semântica nativa.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[janoButton], a[janoButton]',
  template: `
    @if (carregando()) {
      <span class="j-btn__gira" aria-hidden="true"></span>
      @if (textoCarregando()) {
        <span>{{ textoCarregando() }}</span>
      } @else {
        <ng-container [ngTemplateOutlet]="conteudo" />
      }
    } @else {
      <ng-container [ngTemplateOutlet]="conteudo" />
    }
    <ng-template #conteudo><ng-content /></ng-template>
  `,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'carregando() ? "true" : null',
    '[attr.aria-disabled]': 'carregando() ? "true" : null',
  },
})
export class JanoButton {
  readonly variant = input<JanoButtonVariant>('primary');
  readonly large = input(false);
  readonly small = input(false);
  /** Ação em andamento: indicador, texto de espera e sem novos toques. */
  readonly carregando = input(false);
  /** Texto durante a ação ("Salvando…"); sem ele, fica o rótulo de sempre. */
  readonly textoCarregando = input('');

  protected readonly classes = computed(
    () =>
      `j-btn${this.large() ? ' j-btn--lg' : ''}${this.small() ? ' j-btn--sm' : ''} j-btn--${this.variant()}${this.carregando() ? ' j-btn--carregando' : ''}`,
  );
}
