import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { JanoIcon } from './icon';
import { corDoDesenho, logoDaLoja } from './logo-loja';

/**
 * Quadrado arredondado com o ícone da categoria: ícone na cor cheia, fundo na versão suave
 * ("cat-N-soft"). Com `loja` de uma marca conhecida (Netflix, Apple, iFood…), mostra o logo dela
 * na cor da marca; a categoria continua no texto ao lado.
 */
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
    /* Logo colorido em arquivo: fundo branco, como as marcas são desenhadas. */
    .arquivo {
      background: #fff;
      box-shadow: inset 0 0 0 1px var(--border);
      overflow: hidden;
    }
    .arquivo img {
      object-fit: contain;
    }
  `,
  template: `@if (logo()?.arquivo; as arquivo) {
      <span
        class="b arquivo"
        [style.width.px]="size()"
        [style.height.px]="size()"
      >
        <img
          [src]="arquivo"
          [alt]="logo()!.nome"
          [title]="logo()!.nome"
          [width]="size() * 0.8"
          [height]="size() * 0.8"
          loading="lazy"
        />
      </span>
    } @else if (logo(); as l) {
      <span
        class="b"
        role="img"
        [attr.aria-label]="l.nome"
        [title]="l.nome"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.background]="l.cor"
      >
        <svg
          viewBox="0 0 24 24"
          [attr.width]="size() * 0.55"
          [attr.height]="size() * 0.55"
          aria-hidden="true"
        >
          <path [attr.d]="l.d ?? ''" [attr.fill]="desenho()" />
        </svg>
      </span>
    } @else {
      <span
        class="b"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.color]="color()"
        [style.background]="bg()"
      >
        <jano-icon [name]="icon()" [size]="size() * 0.55" />
      </span>
    }`,
})
export class JanoCategoryBadge {
  readonly icon = input<string | null | undefined>();
  /** Nome do token de cor, ex.: "cat-3". */
  readonly colorToken = input<string | null | undefined>('cat-1');
  readonly size = input(36);
  /** Descrição ou nome do lançamento: com uma marca conhecida, mostra o logo dela. */
  readonly loja = input<string | null | undefined>();

  protected readonly logo = computed(() => logoDaLoja(this.loja()));
  protected readonly desenho = computed(() => {
    const l = this.logo();
    return l ? corDoDesenho(l.cor) : '';
  });

  protected readonly color = computed(
    () => `var(--${this.colorToken() || 'cat-1'})`,
  );
  protected readonly bg = computed(
    () =>
      `var(--${this.colorToken() || 'cat-1'}-soft, color-mix(in srgb, var(--${this.colorToken() || 'cat-1'}) 16%, transparent))`,
  );
}
