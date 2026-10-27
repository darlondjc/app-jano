import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { formatBRL, goalStatus } from '@jano/engine';

/** Barra de meta mensal: gasto × limite, marcador de ritmo e frase de estado (cor nunca sozinha). */
@Component({
  selector: 'jano-goal-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'j-card j-goal j-goal--' + modifier()">
      <div class="j-goal__head">
        <span>{{ name() }}</span
        ><span class="j-goal__pct j-num">{{ percent() }}%</span>
      </div>
      <div
        class="j-goal__track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent()"
        [attr.aria-label]="name()"
      >
        <div class="j-goal__fill" [style.width.%]="fill()"></div>
        @if (pace() !== undefined) {
          <div class="j-goal__pace" [style.left.%]="paceLeft()"></div>
        }
      </div>
      <div class="j-goal__meta">
        <span>{{ money(spentCents()) }} de {{ money(limitCents()) }}</span>
        @if (pace() !== undefined) {
          <span>Ritmo ideal: {{ paceLeft() }}%</span>
        }
      </div>
      <div class="j-goal__state">{{ message() }}</div>
    </div>
  `,
})
export class JanoGoalBar {
  readonly name = input.required<string>();
  readonly spentCents = input.required<number>();
  readonly limitCents = input.required<number>();
  /** Fração do mês decorrida (0–1). Omitir em meses encerrados. */
  readonly pace = input<number>();
  /** Dias que faltam no mês, para a mensagem de atenção. */
  readonly daysLeft = input<number>();

  protected readonly status = computed(() =>
    goalStatus(this.spentCents(), this.limitCents()),
  );
  protected readonly modifier = computed(
    () => ({ ok: 'ok', warning: 'warn', over: 'over' })[this.status()],
  );
  protected readonly percent = computed(() => {
    const limit = this.limitCents();
    return limit > 0
      ? Math.round((this.spentCents() / limit) * 100)
      : this.spentCents() > 0
        ? 100
        : 0;
  });
  protected readonly fill = computed(() => Math.min(this.percent(), 100));
  protected readonly paceLeft = computed(() =>
    Math.round((this.pace() ?? 0) * 100),
  );

  protected readonly message = computed(() => {
    const left = this.limitCents() - this.spentCents();
    switch (this.status()) {
      case 'ok':
        return `No ritmo. Sobram ${formatBRL(left)}.`;
      case 'warning': {
        const d = this.daysLeft();
        return d !== undefined
          ? `Atenção: restam ${d} ${d === 1 ? 'dia' : 'dias'} e ${formatBRL(left)}.`
          : `Atenção: restam ${formatBRL(left)}.`;
      }
      case 'over':
        return `Passou ${formatBRL(-left)} da meta.`;
    }
  });

  protected money = formatBRL;
}
