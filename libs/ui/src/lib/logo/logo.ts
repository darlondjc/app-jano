import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Chave de duas faces + nome. `tone="light"` para fundo teal. */
@Component({
  selector: 'jano-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    span {
      font: 600 32px/1 var(--font-sans);
      letter-spacing: -0.03em;
    }
  `,
  template: `
    <svg
      [attr.width]="size() * 0.63"
      [attr.height]="size()"
      viewBox="12 0 40 64"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="15"
        r="9"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="5"
      />
      <path
        d="M32 24 V58 M32 42 H19 M32 52 H25 M32 42 H45 M32 52 H39"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="5"
        stroke-linecap="round"
      />
    </svg>
    <span [style.color]="color()">jano</span>
  `,
})
export class JanoLogo {
  readonly tone = input<'brand' | 'light'>('brand');
  readonly size = input(38);
  protected readonly color = computed(() =>
    this.tone() === 'light' ? '#ffffff' : 'var(--primary)',
  );
}
