import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { formatBRL, valoresOcultos } from '@jano/engine';
import type { PodeGastar } from '../inicio/pode-gastar';
import type { PlanoDoMes } from './plano';

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Acima disso, a renda fica apertada: aviso no gráfico. */
const LIMITE_COMPROMETIDO = 80;

/**
 * Plano do mês: até o salário, o que vem nos próximos 30 dias e quanto da renda dos
 * próximos meses já está comprometido. Só leitura; os números vêm de `planoDoMes`.
 */
@Component({
  selector: 'jano-plano-mes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    @media (min-width: 1024px) {
      :host {
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
        align-items: start;
      }
      .j-hero {
        grid-column: 1 / -1;
      }
    }
    h2 {
      margin: 0 0 4px;
      font: 600 18px/26px var(--font-sans);
    }
    .sub {
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .hero-topo {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px 16px;
    }
    ol {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    li {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 12px 0;
    }
    li + li {
      border-top: 1px solid var(--border);
    }
    .data {
      text-align: center;
      line-height: 1.1;
    }
    .data b {
      display: block;
      font: 700 18px/1 var(--font-sans);
    }
    .data small {
      font: 600 11px/1 var(--font-sans);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-2);
    }
    .nome {
      font: 500 15px/20px var(--font-sans);
      overflow-wrap: anywhere;
    }
    .valor {
      text-align: right;
      font: 500 15px/20px var(--font-sans);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .valor.entra {
      color: var(--positive);
    }
    .valor small {
      display: block;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    .valor small.negativo {
      color: var(--danger);
    }
    svg {
      display: block;
      width: 100%;
      max-width: 440px;
      height: auto;
      margin: 8px auto 0;
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
      margin-top: 8px;
    }
    .legenda span::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: 6px;
      vertical-align: -1px;
      background: var(--c);
    }
    .alerta {
      margin: 8px 0 0;
      font: 500 14px/20px var(--font-sans);
      color: var(--warning-text);
    }
  `,
  template: `
    @if (plano().gastar; as g) {
      <section class="j-hero" aria-label="Até o salário">
        <div class="j-hero__label">
          Até o salário, em {{ dataCurta(g.salario) }} ·
          {{ g.dias === 1 ? 'falta 1 dia' : 'faltam ' + g.dias + ' dias' }}
        </div>
        <div class="hero-topo">
          <div class="j-hero__valor j-num">
            {{ g.livreCents < 0 ? '−' : '' }}{{ reais(g.livreCents) }}
          </div>
          <div class="j-hero__destaque">{{ reais(g.porDiaCents) }} por dia</div>
        </div>
        <div class="j-hero__nota">{{ nota(g) }}</div>
      </section>
    }

    <section class="j-card" aria-label="Próximos 30 dias">
      <h2>O que vem nos próximos 30 dias</h2>
      <div class="sub">
        Entradas e contas que se repetem todo mês, e a fatura do cartão.
        @if (temSaldo()) {
          Abaixo de cada valor, o saldo previsto depois dele.
        }
      </div>
      <ol>
        @for (e of plano().eventos; track e.nome + e.data) {
          <li>
            <div class="data" [attr.aria-label]="e.data ?? 'sem data'">
              @if (e.data) {
                <b>{{ e.data.slice(8, 10) }}</b
                ><small>{{ mesCurto(e.data) }}</small>
              } @else {
                <b>—</b>
              }
            </div>
            <div>
              <div class="nome">{{ e.nome }}</div>
              <div class="sub">{{ e.sub }}</div>
            </div>
            <div class="valor" [class.entra]="e.cents > 0">
              {{ e.cents > 0 ? '+' : '−' }}{{ money(abs(e.cents)) }}
              @if (e.saldoDepois !== null) {
                <small [class.negativo]="e.saldoDepois < 0"
                  >saldo {{ money(e.saldoDepois) }}</small
                >
              }
            </div>
          </li>
        } @empty {
          <li>
            <span></span>
            <span class="sub"
              >Nenhuma entrada ou conta recorrente nos próximos 30 dias.</span
            >
            <span></span>
          </li>
        }
      </ol>
    </section>

    <section class="j-card" aria-label="Renda já comprometida">
      <h2>Renda já comprometida</h2>
      <div class="sub">{{ resumo() }}</div>
      <svg
        [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h"
        role="img"
        [attr.aria-label]="descricao()"
      >
        @for (l of [0, 50, 100]; track l) {
          <line
            [attr.x1]="g.x0"
            [attr.x2]="g.w - 4"
            [attr.y1]="y(l)"
            [attr.y2]="y(l)"
            style="stroke: var(--chart-grid)"
          />
          <text
            [attr.x]="g.x0 - 6"
            [attr.y]="y(l) + 4"
            text-anchor="end"
            font-size="11"
            style="fill: var(--text-2)"
          >
            {{ l }}%
          </text>
        }
        @for (b of barras(); track b.mes) {
          <rect
            [attr.x]="b.x"
            [attr.y]="b.yFixas"
            [attr.width]="b.largura"
            [attr.height]="b.hFixas"
            rx="4"
            style="fill: var(--cat-2)"
          />
          @if (b.hParcelas > 0) {
            <rect
              [attr.x]="b.x"
              [attr.y]="b.yParcelas"
              [attr.width]="b.largura"
              [attr.height]="b.hParcelas"
              rx="4"
              style="fill: var(--cat-3)"
            />
          }
          <text
            [attr.x]="b.x + b.largura / 2"
            [attr.y]="b.yTopo - 6"
            text-anchor="middle"
            font-size="12"
            font-weight="600"
            style="fill: var(--text)"
          >
            {{ b.rotulo }}
          </text>
          <text
            [attr.x]="b.x + b.largura / 2"
            [attr.y]="g.h - 4"
            text-anchor="middle"
            font-size="12"
            style="fill: var(--text-2)"
          >
            {{ b.nomeMes }}
          </text>
        }
      </svg>
      <div class="legenda">
        <span style="--c: var(--cat-2)">Contas fixas</span>
        <span style="--c: var(--cat-3)">Parcelas</span>
      </div>
      @if (apertado(); as m) {
        <p class="alerta">
          Em {{ m }}, mais de {{ limite }}% da renda já está comprometida.
        </p>
      }
    </section>
  `,
})
export class PlanoMes {
  readonly plano = input.required<PlanoDoMes>();

  protected readonly money = formatBRL;
  protected readonly limite = LIMITE_COMPROMETIDO;
  protected readonly abs = Math.abs;
  protected readonly g = { w: 320, h: 180, x0: 38, topo: 22, base: 156 };

  protected readonly temSaldo = computed(() =>
    this.plano().eventos.some((e) => e.saldoDepois !== null),
  );

  protected reais(cents: number): string {
    if (valoresOcultos()) return formatBRL(cents);
    return `R$ ${new Intl.NumberFormat('pt-BR').format(Math.floor(Math.abs(cents) / 100))}`;
  }
  protected nota(g: PodeGastar): string {
    const partes = [
      g.faturaCents ? `da fatura do cartão (${formatBRL(g.faturaCents)})` : '',
      g.contasCents
        ? `das contas fixas que vencem antes (${formatBRL(g.contasCents)})`
        : '',
    ].filter(Boolean);
    return partes.length
      ? `Livre depois ${partes.join(' e ')}.`
      : 'Saldo das contas; nenhuma conta fixa vence antes do salário.';
  }
  protected dataCurta(iso: string): string {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  }
  protected mesCurto(iso: string): string {
    return MESES[Number(iso.slice(5, 7)) - 1];
  }

  /** Altura em pixels para um percentual (0 a 100, cortado em 100). */
  protected y(pct: number): number {
    const p = Math.min(Math.max(pct, 0), 100);
    return this.g.base - ((this.g.base - this.g.topo) * p) / 100;
  }

  protected readonly barras = computed(() => {
    const { comprometido, rendaCents } = this.plano();
    const n = comprometido.length;
    const passo = (this.g.w - 4 - this.g.x0) / Math.max(n, 1);
    const largura = Math.min(40, passo * 0.55);
    // Sem renda conhecida, as barras usam o maior total como 100%.
    const base =
      rendaCents ||
      Math.max(1, ...comprometido.map((m) => m.fixasCents + m.parcelasCents));
    return comprometido.map((m, i) => {
      const pctFixas = (m.fixasCents / base) * 100;
      const pctTotal = ((m.fixasCents + m.parcelasCents) / base) * 100;
      const yFixas = this.y(pctFixas);
      const yTopo = this.y(pctTotal);
      return {
        mes: m.mes,
        nomeMes: MESES[Number(m.mes.slice(5, 7)) - 1],
        x: this.g.x0 + passo * i + (passo - largura) / 2,
        largura,
        yFixas,
        hFixas: this.g.base - yFixas,
        yParcelas: yTopo,
        hParcelas: yFixas - yTopo,
        yTopo,
        rotulo:
          m.pct === null
            ? formatBRL(m.fixasCents + m.parcelasCents)
            : `${m.pct}%`,
      };
    });
  });

  protected readonly resumo = computed(() => {
    const { comprometido, rendaCents } = this.plano();
    const primeiro = comprometido[0];
    if (!primeiro) return '';
    const total = primeiro.fixasCents + primeiro.parcelasCents;
    if (!rendaCents)
      return `${formatBRL(total)} por mês em contas fixas e parcelas. Sem renda recorrente identificada para comparar.`;
    return `Contas fixas e parcelas somam ${formatBRL(total)} no próximo mês, de uma renda de ${formatBRL(rendaCents)}. A barra cai quando uma parcela termina.`;
  });

  protected readonly descricao = computed(() =>
    this.barras()
      .map((b) => `${b.nomeMes}: ${b.rotulo}`)
      .join(', '),
  );

  protected readonly apertado = computed(() => {
    const m = this.plano().comprometido.find(
      (c) => c.pct !== null && c.pct > LIMITE_COMPROMETIDO,
    );
    return m ? MESES[Number(m.mes.slice(5, 7)) - 1] : null;
  });
}
