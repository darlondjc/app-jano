import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { JanoIcon } from './icon';

/** Quadrado arredondado com o ícone da categoria: ícone na cor cheia, fundo na versão suave ("cat-N-soft"). */
@Component({
  selector: 'jano-category-badge',
  imports: [JanoIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }
    .b {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 28%;
      flex: none;
    }
  `,
  template: `<span
    class="b"
    [style.width.px]="size()"
    [style.height.px]="size()"
    [style.color]="color()"
    [style.background]="bg()"
  >
    <jano-icon [name]="icon()" [size]="size() * 0.55" />
  </span>`,
})
export class JanoCategoryBadge {
  readonly icon = input<string | null | undefined>();
  /** Nome do token de cor, ex.: "cat-3". */
  readonly colorToken = input<string | null | undefined>('cat-1');
  readonly size = input(36);

  protected readonly color = computed(
    () => `var(--${this.colorToken() || 'cat-1'})`,
  );
  protected readonly bg = computed(
    () =>
      `var(--${this.colorToken() || 'cat-1'}-soft, color-mix(in srgb, var(--${this.colorToken() || 'cat-1'}) 16%, transparent))`,
  );
}
