import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CategoryDoc } from '@jano/data-access';
import { formatBRL } from '@jano/engine';
import type { CartaoFatura } from './fatura';

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

/** Fatura do cartão no Início: quanto, quando, limite, para onde foi e o que vem todo mês. */
@Component({
  selector: 'jano-fatura-cartao',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .topo {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }
    .plastico {
      width: 44px;
      height: 30px;
      border-radius: 6px;
      background: var(--brand-deep);
      position: relative;
    }
    .plastico::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 9px;
      width: 9px;
      height: 7px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--on-brand) 55%, transparent);
    }
    .nome {
      font: 600 16px/22px var(--font-sans);
    }
    .sub {
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .chip {
      font: 600 12px/1 var(--font-sans);
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      color: var(--text-2);
      white-space: nowrap;
    }
    .chip.atencao {
      background: var(--warning-soft);
      color: var(--warning-text);
    }
    .chip.perigo {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .paga {
      margin-top: 8px;
      font: 500 13px/18px var(--font-sans);
      color: var(--positive);
    }
    .valor {
      font: 700 30px/36px var(--font-sans);
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }
    .rotulo {
      font: 500 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .barra {
      display: flex;
      height: 10px;
      border-radius: var(--radius-pill);
      overflow: hidden;
      background: var(--surface-2);
      gap: 2px;
    }
    .barra span {
      display: block;
      height: 100%;
    }
    .limite .barra span {
      background: var(--primary);
      border-radius: var(--radius-pill);
    }
    .limite.alto .barra span {
      background: var(--warning);
    }
    .linha {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    h3 {
      margin: 0 0 8px;
      font: 600 14px/20px var(--font-sans);
    }
    ul {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: baseline;
      font: 400 14px/20px var(--font-sans);
    }
    li .n {
      overflow-wrap: anywhere;
    }
    li .n i {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: 1px;
    }
    li .v {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    li .v small {
      color: var(--text-2);
      margin-left: 6px;
    }
    .bloco + .bloco {
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .seguinte {
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
      background: var(--surface-2);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
    }
    a.ver {
      align-self: flex-start;
      color: var(--primary-text);
      font: 600 14px/20px var(--font-sans);
      text-decoration: none;
    }
    a.ver:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
  `,
  template: `
    @let f = fatura();
    <section class="j-card" aria-label="Fatura do cartão">
      <div class="topo">
        <span class="plastico" aria-hidden="true"></span>
        <div>
          <div class="nome">{{ f.nome }}</div>
          <div class="sub">
            {{ f.bandeira ?? 'Cartão de crédito' }}
            @if (f.final) {
              · final {{ f.final }}
            }
          </div>
        </div>
        <span [class]="'chip ' + tomSituacao()">{{ f.situacao }}</span>
      </div>

      <div class="bloco">
        <div class="rotulo">{{ rotuloValor() }}</div>
        <div class="valor">{{ money(f.valorCents) }}</div>
        <div class="sub">{{ datas() }}</div>
        @if (f.paga; as p) {
          <div class="paga">
            Fatura anterior paga em {{ diaMes(p.date) }} ·
            {{ money(p.cents) }}
          </div>
        }
      </div>

      @if (f.limite; as l) {
        <div class="bloco limite" [class.alto]="l.pct >= 80">
          <div class="rotulo">Limite usado · {{ l.pct }}%</div>
          <div
            class="barra"
            role="img"
            [attr.aria-label]="l.pct + '% do limite usado'"
          >
            <span [style.width.%]="minimo(l.pct)"></span>
          </div>
          <div class="linha">
            <span>{{ money(l.disponivelCents) }} disponíveis</span>
            <span>de {{ money(l.limiteCents) }}</span>
          </div>
        </div>
      }

      @if (f.composicao.length) {
        <div class="bloco">
          <h3>
            Para onde foi · {{ f.compras }}
            {{ f.compras === 1 ? 'compra' : 'compras' }}
          </h3>
          <div class="barra" role="img" [attr.aria-label]="resumoPartes()">
            @for (p of f.composicao; track p.categoryId) {
              <span
                [style.width.%]="p.pct"
                [style.background]="cor(p.categoryId)"
              ></span>
            }
          </div>
          <ul>
            @for (p of f.composicao; track p.categoryId) {
              <li>
                <span class="n"
                  ><i [style.background]="cor(p.categoryId)"></i
                  >{{ nomeCat(p.categoryId) }}</span
                >
                <span class="v"
                  >{{ money(p.cents) }}<small>{{ p.pct }}%</small></span
                >
              </li>
            }
          </ul>
        </div>
      }

      @if (f.maiores.length) {
        <div class="bloco">
          <h3>Maiores compras</h3>
          <ul>
            @for (m of f.maiores; track m.nome + m.date) {
              <li>
                <span class="n"
                  >{{ m.nome }}
                  <span class="sub">· {{ diaMes(m.date) }}</span></span
                >
                <span class="v">{{ money(m.cents) }}</span>
              </li>
            }
          </ul>
        </div>
      }

      @if (f.seguinte; as s) {
        <div class="seguinte">
          Já na próxima fatura: {{ money(s.totalCents) }} em {{ s.compras }}
          {{ s.compras === 1 ? 'compra' : 'compras' }} desde
          {{ diaMes(s.desde) }}, contando as que ainda estão pendentes.
        </div>
      }

      @if (f.todoMes.itens.length) {
        <div class="bloco">
          <h3>Todo mês no cartão · {{ money(f.todoMes.totalCents) }}</h3>
          <ul>
            @for (i of f.todoMes.itens.slice(0, 4); track i.nome) {
              <li>
                <span class="n"
                  >{{ i.nome }} <span class="sub">· {{ i.detalhe }}</span></span
                >
                <span class="v">{{ money(i.cents) }}</span>
              </li>
            }
          </ul>
        </div>
      }

      @if (f.accountId) {
        <a
          class="ver"
          routerLink="/transacoes"
          [queryParams]="{ conta: f.accountId }"
          >Ver compras do cartão ›</a
        >
      }
    </section>
  `,
})
export class FaturaCartaoCard {
  readonly fatura = input.required<CartaoFatura>();
  readonly categorias = input<CategoryDoc[]>([]);

  protected readonly money = formatBRL;

  protected readonly tomSituacao = computed(() => {
    const s = this.fatura().situacao;
    if (s === 'vencida') return 'perigo';
    return /vence (hoje|amanhã|em [1-3] dias)/.test(s) ? 'atencao' : '';
  });
  protected readonly rotuloValor = computed(
    () =>
      ({
        fechada: 'Fatura fechada',
        aberta: 'Fatura aberta até agora',
        estimada: 'Fatura atual',
      })[this.fatura().fase],
  );
  protected readonly datas = computed(() => {
    const f = this.fatura();
    const partes: string[] = [];
    if (f.fase === 'aberta' && f.fecha)
      partes.push(`fecha ${this.diaMes(f.fecha)}`);
    if (f.vence) partes.push(`vence ${this.diaMes(f.vence)}`);
    if (f.minimoCents) partes.push(`mínimo ${formatBRL(f.minimoCents)}`);
    return partes.join(' · ') || 'Datas a confirmar na próxima sincronização';
  });
  protected readonly resumoPartes = computed(() =>
    this.fatura()
      .composicao.map((p) => `${this.nomeCat(p.categoryId)} ${p.pct}%`)
      .join(', '),
  );

  protected nomeCat(id: string | null): string {
    if (id === 'outras') return 'Outras';
    if (!id) return 'Sem categoria';
    return this.categorias().find((c) => c.id === id)?.name ?? 'Categoria';
  }
  protected cor(id: string | null): string {
    if (id === 'outras') return 'var(--text-2)';
    if (!id) return 'var(--border-strong)';
    const c = this.categorias().find((x) => x.id === id)?.color;
    return c ? `var(--${c})` : 'var(--text-2)';
  }
  protected diaMes(iso: string): string {
    return `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
  }
  /** Barra visível mesmo com uso pequeno. */
  protected minimo(pct: number): number {
    return pct > 0 ? Math.max(pct, 2) : 0;
  }
}
