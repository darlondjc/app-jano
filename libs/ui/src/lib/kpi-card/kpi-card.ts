import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Indicador com valor em destaque; os centavos ficam menores. */
@Component({
  selector: 'jano-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="j-card j-kpi">
      <div class="j-kpi__label">{{ label() }}</div>
      <div
        [class]="
          'j-kpi__value j-num' +
          (balance() ? ' j-kpi__value--balance' : '') +
          toneClass()
        "
      >
        {{ sign() }}R$ {{ reais()
        }}<span class="j-kpi__cents">,{{ centavos() }}</span>
      </div>
      <ng-content />
    </div>
  `,
})
export class JanoKpiCard {
  readonly label = input.required<string>();
  readonly valueCents = input.required<number>();
  /** Destaque maior, para o saldo. */
  readonly balance = input(false);
  /** Cor do valor: entrada (verde), saída (vermelho), automático pelo sinal ou nenhuma. */
  readonly tone = input<'in' | 'out' | 'auto' | null>(null);
  protected readonly toneClass = computed(() => {
    const t = this.tone();
    const kind = t === 'auto' ? (this.valueCents() < 0 ? 'out' : 'in') : t;
    return kind ? ` j-kpi__value--${kind}` : '';
  });

  private readonly abs = computed(() => Math.abs(this.valueCents()));
  protected readonly sign = computed(() => (this.valueCents() < 0 ? '−' : ''));
  protected readonly reais = computed(() =>
    new Intl.NumberFormat('pt-BR').format(Math.trunc(this.abs() / 100)),
  );
  protected readonly centavos = computed(() =>
    String(this.abs() % 100).padStart(2, '0'),
  );
}
