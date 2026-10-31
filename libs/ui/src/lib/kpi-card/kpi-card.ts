import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { valoresOcultos } from '@jano/engine';

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
        @if (oculto()) {
          R$ ••••••
        } @else {
          {{ sign() }}R$ {{ reais()
          }}<span class="j-kpi__cents">,{{ centavos() }}</span>
        }
      </div>
      <ng-content />
      @if (pontos(); as p) {
        <svg
          class="j-spark"
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            [attr.points]="p.linha"
            fill="none"
            [attr.stroke]="corSerie()"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <circle
            [attr.cx]="p.fimX"
            [attr.cy]="p.fimY"
            r="2.5"
            [attr.fill]="corSerie()"
          />
        </svg>
      }
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
  /** Tendência (do mais antigo ao atual), desenhada como linha fina sob o valor. */
  readonly serie = input<number[]>([]);
  /** Token de cor da linha de tendência. */
  readonly corTendencia = input('text-2');
  protected readonly corSerie = computed(() => `var(--${this.corTendencia()})`);
  protected readonly pontos = computed(() => {
    const v = this.serie();
    if (v.length < 2) return null;
    const min = Math.min(...v);
    const amp = Math.max(...v) - min || 1;
    const xy = v.map((n, i) => [
      (i / (v.length - 1)) * 100,
      24 - ((n - min) / amp) * 20,
    ]);
    const [fimX, fimY] = xy[xy.length - 1];
    return {
      linha: xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      fimX,
      fimY,
    };
  });
  protected readonly toneClass = computed(() => {
    const t = this.tone();
    const kind = t === 'auto' ? (this.valueCents() < 0 ? 'out' : 'in') : t;
    return kind ? ` j-kpi__value--${kind}` : '';
  });

  protected readonly oculto = valoresOcultos;
  private readonly abs = computed(() => Math.abs(this.valueCents()));
  protected readonly sign = computed(() => (this.valueCents() < 0 ? '−' : ''));
  protected readonly reais = computed(() =>
    new Intl.NumberFormat('pt-BR').format(Math.trunc(this.abs() / 100)),
  );
  protected readonly centavos = computed(() =>
    String(this.abs() % 100).padStart(2, '0'),
  );
}
