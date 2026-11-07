import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { formatBRL, valoresOcultos } from '@jano/engine';
import { rotuloEixo } from './grafico-acumulado';

export interface DiaDeGasto {
  /** Dia do período, a partir de 1. */
  dia: number;
  /** Dia do mês da data (eixo de baixo). */
  diaDoMes: number;
  /** "sáb, 7 nov". */
  rotulo: string;
  cents: number;
  /** Maior gasto do dia, para dizer o que pesou. */
  maior: { nome: string; cents: number } | null;
}

export interface ReferenciaDiaria {
  cents: number;
  /** "R$ 415/dia". */
  rotulo: string;
  /** De onde vem: "Pode gastar R$ 415/dia" ou "Meta R$ 250/dia". */
  legenda: string;
}

/** Largura do eixo de valores, fixo à esquerda. */
const EIXO = 52;
/** Coluna mínima por dia: abaixo disso a barra não se lê no celular, e o gráfico rola. */
const COLUNA_MIN = 26;
const COLUNA_MAX = 48;
/** Topo da área das barras: espaço para o valor das barras cortadas. */
const Y0 = 26;
const PASSOS_REAIS = [
  25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000,
];

/**
 * Gasto de cada dia do período até hoje, em barras, contra uma referência diária (o "pode
 * gastar por dia" ou a meta dividida pelos dias). A escala segue os dados: só os dias que já
 * passaram, com coluna mínima legível; se não couberem, o gráfico rola na horizontal e abre
 * no dia de hoje, com o eixo de valores fixo. Dias acima da referência ficam em âmbar; tocar
 * numa barra mostra o total do dia e o maior gasto.
 */
@Component({
  selector: 'jano-grafico-por-dia',
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
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .legenda i.linha {
      width: 20px;
      height: 0;
      border-radius: 0;
      border-top: 2px dashed var(--text-2);
    }
    .grafico {
      display: flex;
      margin-top: 16px;
    }
    .grafico > svg {
      flex: none;
      display: block;
    }
    .rolagem {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
    }
    .rolagem svg {
      display: block;
    }
    .grade {
      stroke: var(--border);
      stroke-width: 1;
    }
    .eixo {
      font: 400 11px/1 var(--font-sans);
      fill: var(--text-2);
    }
    .valor-corte {
      font-size: 9.5px;
      letter-spacing: -0.02em;
      font-weight: 600;
      fill: var(--text);
    }
    .eixo.hoje {
      font-weight: 700;
      fill: var(--text);
    }
    .alvo {
      cursor: pointer;
      outline: none;
    }
    .alvo:focus-visible .fundo {
      stroke: var(--focus);
      stroke-width: 2;
    }
    .detalhe {
      margin-top: 8px;
      min-height: 40px;
      font: 400 14px/20px var(--font-sans);
    }
    .detalhe b {
      font-variant-numeric: tabular-nums;
    }
    .detalhe .acima {
      color: var(--warning-text);
    }
    .detalhe .sub {
      color: var(--text-2);
      font-size: 13px;
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
      <span><i style="background: var(--primary)"></i>Gasto do dia</span>
      @if (referencia(); as r) {
        @if (algumAcima()) {
          <span
            ><i style="background: var(--warning)"></i>Acima de
            {{ r.rotulo }}</span
          >
        }
        @if (yRef() !== null) {
          <span><i class="linha"></i>{{ r.legenda }}</span>
        }
      }
    </div>
    <div class="grafico" role="group" [attr.aria-label]="resumo()">
      <svg [attr.width]="eixo" [attr.height]="h" aria-hidden="true">
        @for (t of ticks(); track t.y) {
          <text class="eixo" x="0" [attr.y]="t.y + 4">{{ t.rotulo }}</text>
        }
      </svg>
      <div class="rolagem" #rolagem>
        <svg [attr.width]="largura()" [attr.height]="h">
          @for (t of ticks(); track t.y) {
            <line
              class="grade"
              x1="0"
              [attr.x2]="largura()"
              [attr.y1]="t.y"
              [attr.y2]="t.y"
            />
          }
          @for (b of barras(); track b.dia) {
            <g
              class="alvo"
              role="button"
              tabindex="0"
              [attr.aria-label]="b.aria"
              [attr.aria-pressed]="b.dia === selecionado()"
              (click)="selecionado.set(b.dia)"
              (keydown.enter)="selecionado.set(b.dia)"
              (keydown.space)="selecionado.set(b.dia); $event.preventDefault()"
            >
              <rect
                class="fundo"
                [attr.x]="b.xAlvo"
                [attr.y]="y0"
                [attr.width]="b.wAlvo"
                [attr.height]="y1 - y0"
                fill="transparent"
                rx="3"
              />
              <rect
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.w"
                [attr.height]="b.altura"
                rx="3"
                [style.fill]="b.acima ? 'var(--warning)' : 'var(--primary)'"
                [attr.opacity]="b.dia === selecionado() ? 1 : 0.6"
              />
              @if (b.cortada) {
                <!-- Corte: a barra passa do teto; o valor fica escrito em cima. -->
                <rect
                  [attr.x]="b.x - 1"
                  [attr.y]="y0 + 7"
                  [attr.width]="b.w + 2"
                  height="3"
                  style="fill: var(--surface)"
                />
                <clipPath [attr.id]="'gpd-corte-' + b.dia">
                  <rect
                    [attr.x]="b.xAlvo"
                    y="0"
                    [attr.width]="b.wAlvo"
                    [attr.height]="y0"
                  />
                </clipPath>
                <text
                  class="eixo valor-corte"
                  [attr.clip-path]="'url(#gpd-corte-' + b.dia + ')'"
                  [attr.x]="b.xRotulo"
                  [attr.y]="y0 - 6"
                  text-anchor="middle"
                >
                  {{ b.valorCurto }}
                </text>
              }
              @if (b.rotuloX) {
                <text
                  class="eixo"
                  [class.hoje]="b.dia === ultimo()"
                  [attr.x]="b.xc"
                  [attr.y]="y1 + 18"
                  text-anchor="middle"
                >
                  {{ b.rotuloX }}
                </text>
              }
            </g>
          }
          @if (yRef(); as y) {
            <line
              x1="0"
              [attr.x2]="largura()"
              [attr.y1]="y"
              [attr.y2]="y"
              style="stroke: var(--text-2)"
              stroke-width="1.5"
              stroke-dasharray="6 5"
            />
          }
        </svg>
      </div>
    </div>
    <div class="detalhe" aria-live="polite">
      @if (diaSelecionado(); as d) {
        <div>
          {{ d.rotulo }}: <b>{{ money(d.cents) }}</b>
          @if (referencia(); as r) {
            @if (d.cents > r.cents) {
              <span class="acima">
                · {{ money(d.cents - r.cents) }} acima de {{ r.rotulo }}</span
              >
            }
          }
        </div>
        @if (d.maior; as m) {
          <div class="sub">
            Maior gasto: {{ m.nome }} · {{ money(m.cents) }}
          </div>
        } @else if (!d.cents) {
          <div class="sub">Nenhum gasto neste dia.</div>
        }
      }
    </div>
    <details>
      <summary>Ver os valores do gráfico</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Gasto</th>
          </tr>
        </thead>
        <tbody>
          @for (d of dias(); track d.dia) {
            <tr>
              <td>{{ d.rotulo }}</td>
              <td>{{ money(d.cents) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
})
export class GraficoPorDia {
  /** Dias do período até hoje, do primeiro ao último. */
  readonly dias = input.required<DiaDeGasto[]>();
  readonly referencia = input<ReferenciaDiaria | null>(null);

  /** Dia aberto no detalhe: começa em hoje. */
  protected readonly selecionado = linkedSignal<number | null>(
    () => this.dias().at(-1)?.dia ?? null,
  );
  protected readonly ultimo = computed(() => this.dias().at(-1)?.dia ?? null);
  protected readonly diaSelecionado = computed(
    () => this.dias().find((d) => d.dia === this.selecionado()) ?? null,
  );

  protected readonly eixo = EIXO;
  protected readonly h = 220;
  protected readonly y0 = Y0;
  protected readonly y1 = this.h - 26;
  protected readonly money = formatBRL;

  /** Largura visível da área das barras. */
  private readonly visivel = signal(600);
  private readonly rolagem = viewChild<ElementRef<HTMLElement>>('rolagem');

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const medir = () =>
        this.visivel.set(
          Math.max(Math.round(el.getBoundingClientRect().width) - EIXO, 200),
        );
      medir();
      if (typeof ResizeObserver !== 'undefined')
        new ResizeObserver(medir).observe(el);
    });
    // Abre no dia de hoje: rola até o fim quando os dias (ou a largura) mudam.
    let ultimaChave = '';
    afterRenderEffect(() => {
      const chave = `${this.dias().length}|${this.largura()}`;
      const r = this.rolagem()?.nativeElement;
      if (!r || chave === ultimaChave) return;
      ultimaChave = chave;
      // Depois do próximo quadro: a largura nova do SVG já entrou no layout.
      requestAnimationFrame(() => (r.scrollLeft = r.scrollWidth));
    });
  }

  /** Largura de cada dia: preenche a área se der, nunca abaixo do mínimo legível. */
  private readonly coluna = computed(() => {
    const n = Math.max(this.dias().length, 1);
    const v = this.visivel();
    if (v / n >= COLUNA_MIN) return Math.min(v / n, COLUNA_MAX);
    // Rolando: um número inteiro de dias na tela, para nenhuma barra ficar cortada na borda.
    return v / Math.floor(v / COLUNA_MIN);
  });
  protected readonly largura = computed(() =>
    Math.max(this.coluna() * this.dias().length, this.visivel()),
  );

  /** A escala segue os gastos; a referência só entra nela se estiver perto deles. */
  private readonly refNaEscala = computed(() => {
    const r = this.referencia()?.cents ?? 0;
    const maior = Math.max(...this.dias().map((d) => d.cents), 0);
    return r > 0 && (maior === 0 || r <= maior * 1.6);
  });
  /**
   * Zoom nos dias típicos: o teto fica perto da referência e do gasto habitual (75% dos dias
   * com gasto), não no dia mais caro. Dia muito acima do teto aparece cortado, com o valor.
   */
  private readonly teto = computed(() => {
    const valores = this.dias()
      .map((d) => d.cents)
      .filter((c) => c > 0)
      .sort((a, b) => a - b);
    const maior = valores.at(-1) ?? 0;
    const ref = this.refNaEscala() ? (this.referencia()?.cents ?? 0) : 0;
    const p75 = valores.length
      ? valores[Math.floor((valores.length - 1) * 0.75)]
      : 0;
    const alvo = Math.max(ref * 2, p75 * 1.6, 1);
    // Se o maior dia cabe com folga, nada é cortado.
    const base = maior <= alvo * 1.25 ? Math.max(maior, ref, 1) : alvo;
    const passo =
      PASSOS_REAIS.map((r) => r * 100).find((p) => p * 4 >= base * 1.1) ??
      PASSOS_REAIS.at(-1)! * 100;
    return { passo, max: passo * 4 };
  });
  private readonly py = (v: number) =>
    this.y1 - (Math.max(v, 0) / this.teto().max) * (this.y1 - Y0);

  protected readonly ticks = computed(() =>
    [0, 1, 2, 3, 4].map((i) => ({
      y: this.py(i * this.teto().passo),
      rotulo: rotuloEixo(i * this.teto().passo),
    })),
  );
  protected readonly yRef = computed(() => {
    const r = this.referencia();
    return r && this.refNaEscala() ? this.py(r.cents) : null;
  });
  protected readonly barras = computed(() => {
    const c = this.coluna();
    const w = Math.max(Math.min(c * 0.62, 22), 4);
    const ref = this.referencia()?.cents ?? null;
    // Com colunas estreitas, o dia do mês aparece de dois em dois (e sempre no de hoje).
    const passo = c >= 30 ? 1 : 2;
    const n = this.dias().length;
    return this.dias().map((d, i) => {
      const xc = (i + 0.5) * c;
      const cortada = d.cents > this.teto().max;
      const y = this.py(Math.min(d.cents, this.teto().max));
      return {
        dia: d.dia,
        xc,
        x: xc - w / 2,
        w,
        y,
        // Dia com gasto tem ao menos um traço visível.
        altura: d.cents > 0 ? Math.max(this.y1 - y, 2) : 0,
        cortada,
        valorCurto: cortada ? valorCurto(d.cents) : '',
        // O valor fica preso à coluna (clipPath): não vaza para a vizinha nem pela borda.
        xRotulo: xc,
        xAlvo: xc - c / 2,
        wAlvo: c,
        acima: ref !== null && ref > 0 && d.cents > ref,
        aria: `${d.rotulo}: ${formatBRL(d.cents)}`,
        rotuloX:
          i === n - 1 || (n - 1 - i) % passo === 0 ? String(d.diaDoMes) : '',
      };
    });
  });
  protected readonly algumAcima = computed(() => {
    const r = this.referencia();
    return !!r && this.dias().some((d) => d.cents > r.cents);
  });
  protected readonly resumo = computed(() => {
    const r = this.referencia();
    const acima = r ? this.dias().filter((d) => d.cents > r.cents).length : 0;
    return (
      `Gasto por dia, ${this.dias().length} dias` +
      (r ? `; ${acima} acima de ${r.rotulo}` : '') +
      '. Toque numa barra para ver o dia.'
    );
  });
}

/** "3,5 mil" ou "900": cabe em cima de uma barra estreita. */
function valorCurto(cents: number): string {
  if (valoresOcultos()) return '••';
  const reais = cents / 100;
  return reais >= 1000
    ? `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : String(Math.round(reais));
}
