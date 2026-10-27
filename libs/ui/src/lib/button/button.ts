import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type JanoButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Botão do design system. Uso: <button janoButton variant="primary">Salvar</button> */
@Component({
  // Componente de atributo em <button>/<a>: preserva a semântica nativa.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[janoButton], a[janoButton]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
})
export class JanoButton {
  readonly variant = input<JanoButtonVariant>('primary');
  readonly large = input(false);
  readonly small = input(false);

  protected readonly classes = computed(
    () =>
      `j-btn${this.large() ? ' j-btn--lg' : ''}${this.small() ? ' j-btn--sm' : ''} j-btn--${this.variant()}`,
  );
}
