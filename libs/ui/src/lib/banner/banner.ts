import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type JanoBannerTone = 'info' | 'good' | 'warn' | 'danger';

/** Aviso em linha. Erros usam role="alert"; os demais, role="status". */
@Component({
  selector: 'jano-banner',
  template: `
    <div
      [class]="classes()"
      [attr.role]="tone() === 'danger' ? 'alert' : 'status'"
    >
      <div>
        @if (title()) {
          <span class="j-banner__title">{{ title() }}</span>
        }
        <ng-content />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JanoBanner {
  readonly tone = input<JanoBannerTone>('info');
  readonly title = input<string>();

  protected readonly classes = computed(
    () => `j-banner j-banner--${this.tone()}`,
  );
}
