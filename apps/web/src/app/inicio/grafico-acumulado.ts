import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatBRL, valoresOcultos } from '@jano/engine';

const X0 = 56;
const Y0 = 24; // topo
const PASSOS_REAIS = [
  100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
];

/** "R$ 4,5 mil" / "R$ 800". Valores do eixo, em centavos. */
export function rotuloEixo(cents: number): string {
  if (valoresOcultos()) return 'R$ ••';
  const reais = cents / 100;
  return reais >= 1000
    ? `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : `R$ ${Math.round(reais)}`;
}

/** Gasto acumulado do mês contra o ritmo ideal (a meta total) e a projeção de fechamento. */
@Component({
  selector: 'jano-grafico-acumulado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .legenda {
      margin-top: 12px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    .legenda span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legenda i {
      width: 20px;
      display: inline-block;
    }
    svg {
      display: block;
      margin-top: 16px;
    }
    .grade {
      stroke: var(--border);
      stroke-width: 1;
    }
    .eixo {
      font: 400 11px/1 var(--font-sans);
      fill: var(--text-2);
    }
    details {
      margin-top: 8px;
      font: 400 13px/20px var(--font-sans);
      color: var(--text-2);
    }
    table {
      border-collapse: collapse;
      margin-top: 8px;
    }
    td,
    th {
      padding: 2px 16px 2px 0;
      text-align: left;
      font-weight: 400;
    }
  `,
  template: `
    <div class="legenda">
      <span
        ><i style="border-top: 2.5px solid var(--primary)"></i>Seu gasto</span
      >
      @if (limite() !== null) {
        <span
          ><i style="border-top: 2px dashed var(--text-2)"></i>Ritmo ideal</span
        >
      }
      <span><i style="border-top: 2.5px dashed var(--info)"></i>Projeção</span>
    </div>
    <svg
      [attr.width]="w()"
      [attr.height]="h()"
      role="img"
      [attr.aria-label]="resumo()"
    >
      @for (t of ticks(); track t.y) {
        <line
          class="grade"
          [attr.x1]="x0"
          [attr.x2]="x1()"
          [attr.y1]="t.y"
          [attr.y2]="t.y"
        />
        <text class="eixo" x="0" [attr.y]="t.y + 4">{{ t.rotulo }}</text>
      }
      @if (ideal(); as i) {
        <line
          [attr.x1]="i.x1"
          [attr.y1]="i.y1"
          [attr.x2]="i.x2"
          [attr.y2]="i.y2"
          style="stroke: var(--text-2)"
          stroke-width="1.5"
          stroke-dasharray="6 5"
        />
      }
      <polyline
        fill="none"
        style="stroke: var(--primary)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        [attr.points]="linha()"
      />
      @if (proj(); as p) {
        <polyline
          fill="none"
          style="stroke: var(--info)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-dasharray="6 5"
          [attr.points]="p"
        />
      }
      <line
        [attr.x1]="hoje().x"
        [attr.x2]="hoje().x"
        [attr.y1]="20"
        [attr.y2]="y1() + 2"
        style="stroke: var(--border-strong)"
        stroke-width="1"
        stroke-dasharray="2 3"
      />
      <circle
        [attr.cx]="hoje().x"
        [attr.cy]="hoje().y"
        r="5"
        style="fill: var(--primary)"
      />
      <text class="eixo" [attr.x]="hoje().x - 6" y="36" text-anchor="end">
        hoje
      </text>
      @for (d of rotulosX(); track d.dia) {
        <text
          class="eixo"
          [attr.x]="d.x"
          [attr.y]="y1() + 24"
          text-anchor="middle"
        >
          {{ d.dia }}
        </text>
      }
    </svg>
    <details>
      <summary>Ver os valores do gráfico</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Gasto acumulado</th>
          </tr>
        </thead>
        <tbody>
          @for (v of serie(); track $index) {
            <tr>
              <td>{{ $index + 1 }}</td>
              <td>{{ money(v) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
})
export class GraficoAcumulado {
  /** Acumulado de cada dia, do dia 1 até hoje (centavos). */
  readonly serie = input.required<number[]>();
  readonly dias = input.required<number>();
  /** Meta total do mês (ritmo ideal); null quando não há metas. */
  readonly limite = input<number | null>(null);
  /** Gasto projetado para o último dia. */
  readonly projecao = input.required<number>();

  /** Largura medida do contêiner: o gráfico é redesenhado, e os textos não encolhem no celular. */
  protected readonly w = signal(760);
  protected readonly h = computed(() =>
    Math.round(Math.min(Math.max(this.w() * 0.42, 220), 300)),
  );
  protected readonly x0 = X0;
  protected readonly x1 = computed(() => this.w() - 16);
  private readonly y1 = computed(() => this.h() - 36);
  protected readonly money = formatBRL;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const medir = () =>
        this.w.set(Math.max(Math.round(el.getBoundingClientRect().width), 280));
      medir();
      if (typeof ResizeObserver !== 'undefined')
        new ResizeObserver(medir).observe(el);
    });
  }

  private readonly teto = computed(() => {
    const maior =
      Math.max(this.serie().at(-1) ?? 0, this.limite() ?? 0, this.projecao()) *
      1.08;
    const passo =
      PASSOS_REAIS.map((r) => r * 100).find((p) => p * 4 >= maior) ??
      PASSOS_REAIS.at(-1)! * 100;
    return { passo, max: passo * 4 };
  });

  private readonly px = (dia: number) =>
    X0 + ((dia - 1) / Math.max(this.dias() - 1, 1)) * (this.x1() - X0);
  private readonly py = (v: number) =>
    this.y1() - (v / this.teto().max) * (this.y1() - Y0);

  protected readonly ticks = computed(() =>
    [0, 1, 2, 3, 4].map((i) => ({
      y: this.py(i * this.teto().passo),
      rotulo: rotuloEixo(i * this.teto().passo),
    })),
  );
  protected readonly linha = computed(() =>
    this.serie()
      .map((v, i) => `${this.px(i + 1).toFixed(1)},${this.py(v).toFixed(1)}`)
      .join(' '),
  );
  protected readonly hoje = computed(() => {
    const n = this.serie().length;
    return { x: this.px(n), y: this.py(this.serie().at(-1) ?? 0) };
  });
  protected readonly proj = computed(() => {
    const h = this.hoje();
    return `${h.x.toFixed(1)},${h.y.toFixed(1)} ${this.x1()},${this.py(this.projecao()).toFixed(1)}`;
  });
  protected readonly ideal = computed(() => {
    const l = this.limite();
    if (l === null || l <= 0) return null;
    return {
      x1: X0,
      y1: this.py(l / this.dias()),
      x2: this.x1(),
      y2: this.py(l),
    };
  });
  protected readonly rotulosX = computed(() => {
    const n = this.dias();
    const dias = [1, 8, 15, 22].filter((d) => d < n - 2);
    return [...dias, n].map((dia) => ({ dia, x: this.px(dia) }));
  });
  protected readonly resumo = computed(
    () =>
      `Gasto acumulado do mês: ${formatBRL(this.serie().at(-1) ?? 0)} até o dia ${this.serie().length}` +
      (this.limite() ? `, meta total de ${formatBRL(this.limite()!)}` : '') +
      `; projeção de fechamento em ${formatBRL(this.projecao())}.`,
  );
}
