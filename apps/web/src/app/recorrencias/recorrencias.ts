import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AuthService,
  CatalogRepository,
  TransactionsRepository,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import { formatBRL, previousMonths } from '@jano/engine';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoKpiCard,
  JanoSkeletonCard,
  JanoSkeletonGroup,
  JanoSkeletonKpi,
  JanoSkeletonRows,
  JanoPageHead,
} from '@jano/ui';
import { Progresso } from '../shell/progresso';
import { mesAtual } from '../transacoes/agrupar';
import { marcarTransferencias } from '../transacoes/transferencias';
import {
  montarRecorrencias,
  porGrupo,
  totalMensal,
  type Grupo,
  type LinhaRecorrencia,
} from './linhas';

const MESES_CURTOS = [
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

/** Recorrências: assinaturas, contas fixas e entradas que se repetem todo mês. */
const CHAVE_FECHADOS = 'jano.recorrencias.fechados';

function lerFechados(): ReadonlySet<Grupo> {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(CHAVE_FECHADOS) ?? '[]') as Grupo[],
    );
  } catch {
    return new Set();
  }
}

@Component({
  selector: 'jano-recorrencias',
  imports: [
    JanoPageHead,
    NgTemplateOutlet,
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoCategoryBadge,
    JanoKpiCard,
    JanoSkeletonCard,
    JanoSkeletonGroup,
    JanoSkeletonKpi,
    JanoSkeletonRows,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 8px 16px 48px;
    }
    h2 {
      margin: 0 0 12px;
      font: 600 18px/24px var(--font-sans);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin: 16px 0 24px;
    }
    .colunas {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }
    .cab,
    .linha {
      display: grid;
      grid-template-columns: minmax(0, 2.4fr) 1fr 0.7fr 1fr 1.2fr;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
    }
    .grupo {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 48px;
      padding: 12px 16px;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font: 600 15px/20px var(--font-sans);
      text-align: left;
      cursor: pointer;
    }
    .grupo:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: -2px;
    }
    .grupo svg {
      flex: none;
      color: var(--text-2);
      transition: transform 0.15s;
    }
    .grupo[aria-expanded='false'] svg {
      transform: rotate(-90deg);
    }
    .grupo .qtd {
      font: 500 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .grupo .total {
      margin-left: auto;
      font: 500 14px/20px var(--font-sans);
      color: var(--text-2);
      white-space: nowrap;
    }
    .cab {
      font: 500 12px/16px var(--font-sans);
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--border);
    }
    .linha {
      border-bottom: 1px solid var(--border);
    }
    .linha:last-child {
      border-bottom: 0;
    }
    .quem {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .quem b {
      display: block;
      font: 500 14px/20px var(--font-sans);
    }
    .sub {
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    .valor {
      text-align: right;
      font: 500 14px/20px var(--font-sans);
    }
    .valor.entrada {
      color: var(--positive);
    }
    .lista {
      padding: 0;
      overflow: hidden;
    }
    .etq {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font: 500 12px/16px var(--font-sans);
    }
    .etq.alta {
      background: var(--warning-soft);
      color: var(--warning-text);
    }
    .etq.nova {
      background: var(--info-soft);
      color: var(--info);
    }
    .etq.estavel {
      background: var(--surface-2);
      color: var(--text-2);
    }
    .mobile-extra {
      display: none;
    }
    @media (max-width: 1099px) {
      .colunas {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 719px) {
      .kpis > :last-child {
        grid-column: 1 / -1;
      }
      .cab {
        display: none;
      }
      .linha {
        grid-template-columns: minmax(0, 1fr) auto;
        row-gap: 4px;
      }
      .linha .col-dia,
      .linha .col-prox,
      .linha .col-etq {
        display: none;
      }
      .mobile-extra {
        display: block;
        grid-column: 1 / -1;
        padding-left: 44px;
      }
    }
  `,
  template: `
    <jano-page-head titulo="Recorrências" />
    <div class="j-sub">
      Assinaturas, contas fixas, parcelamentos e entradas que se repetem todo
      mês.
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando recorrências">
        <div class="kpis">
          @for (n of [1, 2, 3]; track n) {
            <jano-skeleton-kpi />
          }
        </div>
        <div class="colunas">
          <jano-skeleton-rows [count]="5" />
        </div>
      </jano-skeleton-group>
    } @else if (!linhas().length) {
      <div class="j-card j-empty" style="margin-top: 24px">
        <div class="j-empty__title">Ainda não detectamos recorrências</div>
        <div class="j-empty__text">
          Precisamos de pelo menos 3 meses de lançamentos para reconhecer o que
          se repete. Importe extratos e faturas dos meses anteriores.
        </div>
        <a janoButton variant="primary" routerLink="/transacoes">Importar</a>
      </div>
    } @else {
      <section class="kpis j-kpis-2col" aria-label="Resumo">
        <jano-kpi-card
          label="Gastos fixos por mês"
          [valueCents]="totalGastos()"
          tone="out"
        >
          <span class="j-cap">{{ resumoGastos() }}</span>
        </jano-kpi-card>
        <jano-kpi-card
          label="Entradas fixas por mês"
          [valueCents]="totalEntradas()"
          tone="in"
        >
          <span class="j-cap">{{
            plural(qtd('entrada'), 'entrada detectada', 'entradas detectadas')
          }}</span>
        </jano-kpi-card>
        <div class="j-card j-kpi">
          <div class="j-kpi__label">Reajustadas</div>
          <div class="j-kpi__value j-num">{{ reajustadas() }}</div>
          <span class="j-cap">cobranças com valor maior que o anterior</span>
        </div>
      </section>

      <div class="colunas">
        <section class="j-card lista" aria-label="Lista de recorrências">
          <div class="cab" aria-hidden="true">
            <span>Estabelecimento</span>
            <span style="text-align: right">Valor</span>
            <span>Dia</span>
            <span>Próxima</span>
            <span>Situação</span>
          </div>
          @for (g of grupos(); track g.grupo) {
            <button
              type="button"
              class="grupo"
              [attr.aria-expanded]="!fechados().has(g.grupo)"
              [attr.aria-controls]="'grupo-' + g.grupo"
              (click)="alternar(g.grupo)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M6 9L12 15L18 9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {{ g.titulo }}
              <span class="qtd">{{ g.linhas.length }}</span>
              <span class="total j-num"
                >{{ g.grupo === 'entradas' ? '+' : '−'
                }}{{ money(g.total) }}/mês</span
              >
            </button>
            @if (!fechados().has(g.grupo)) {
              <div [id]="'grupo-' + g.grupo">
                @for (l of g.linhas; track l.tipo + l.nome + l.cents) {
                  <div class="linha">
                    <div class="quem">
                      <jano-category-badge
                        [icon]="cat(l.categoryId)?.icon ?? 'etiqueta'"
                        [colorToken]="cat(l.categoryId)?.color ?? 'cat-1'"
                        [size]="32"
                      />
                      <div>
                        <b>{{ l.nome }}</b>
                        @if (l.parcela; as p) {
                          <span class="sub"
                            >Parcela {{ p.n }} de {{ p.total }} · termina em
                            {{ mesCurto(p.termina) }}</span
                          >
                        } @else {
                          <span class="sub"
                            >{{
                              l.tipo === 'entrada'
                                ? 'Entrada'
                                : nomeCat(l.categoryId)
                            }}
                            · {{ l.meses }} meses</span
                          >
                        }
                      </div>
                    </div>
                    <div
                      [class]="
                        'valor' + (l.tipo === 'entrada' ? ' entrada' : '')
                      "
                    >
                      {{ l.tipo === 'entrada' ? '+' : '−' }}{{ money(l.cents) }}
                    </div>
                    <div class="col-dia">dia {{ l.day }}</div>
                    <div class="col-prox">{{ dataCurta(l.proxima) }}</div>
                    <div class="col-etq">
                      <ng-container
                        [ngTemplateOutlet]="etq"
                        [ngTemplateOutletContext]="{ l: l }"
                      />
                    </div>
                    <div class="mobile-extra sub">
                      Próxima {{ dataCurta(l.proxima) }} ·
                      <ng-container
                        [ngTemplateOutlet]="etq"
                        [ngTemplateOutletContext]="{ l: l }"
                      />
                    </div>
                  </div>
                }
              </div>
            }
          }
        </section>
      </div>
    }

    <ng-template #etq let-l="l">
      @if (l.parcela) {
        <span class="etq estavel">{{
          l.parcela.faltam === 1 ? 'Falta 1' : 'Faltam ' + l.parcela.faltam
        }}</span>
      } @else if (l.reajustada) {
        <span class="etq alta">Subiu {{ pct(l.pct) }}%</span>
      } @else if (l.nova) {
        <span class="etq nova">Nova</span>
      } @else {
        <span class="etq estavel">Estável</span>
      }
    </ng-template>
  `,
})
export class Recorrencias {
  private readonly auth = inject(AuthService);
  private readonly progresso = inject(Progresso);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly cartoes = signal<ReadonlySet<string>>(new Set());

  protected readonly money = formatBRL;
  private readonly hoje = new Date();
  private readonly month = mesAtual(this.hoje);

  private readonly historico = signal<TransactionDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly linhas = computed<LinhaRecorrencia[]>(() =>
    montarRecorrencias(
      this.historico(),
      `${this.month}-${String(this.hoje.getDate()).padStart(2, '0')}`,
      this.categorias().find((c) => c.id === 'assinaturas')?.id ?? null,
      this.cartoes(),
    ),
  );
  protected readonly grupos = computed(() => porGrupo(this.linhas()));
  /** Grupos recolhidos; lembrados neste aparelho. */
  protected readonly fechados = signal<ReadonlySet<Grupo>>(lerFechados());
  protected readonly resumoGastos = computed(() => {
    const n = (g: Grupo) => this.linhas().filter((l) => l.grupo === g).length;
    return [
      this.plural(n('assinaturas'), 'assinatura', 'assinaturas'),
      this.plural(n('contas'), 'conta fixa', 'contas fixas'),
      this.plural(n('parcelamentos'), 'parcelamento', 'parcelamentos'),
    ].join(' · ');
  });
  protected readonly totalGastos = computed(() =>
    totalMensal(this.linhas(), 'gasto'),
  );
  protected readonly totalEntradas = computed(() =>
    totalMensal(this.linhas(), 'entrada'),
  );
  protected readonly reajustadas = computed(
    () => this.linhas().filter((l) => l.reajustada).length,
  );

  constructor() {
    void this.carregar();
  }

  protected alternar(g: Grupo): void {
    const n = new Set(this.fechados());
    if (!n.delete(g)) n.add(g);
    this.fechados.set(n);
    try {
      localStorage.setItem(CHAVE_FECHADOS, JSON.stringify([...n]));
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  }

  protected qtd(tipo: 'gasto' | 'entrada'): number {
    return this.linhas().filter((l) => l.tipo === tipo).length;
  }

  protected plural(n: number, um: string, varios: string): string {
    return `${n} ${n === 1 ? um : varios}`;
  }

  protected cat(id: string | null): CategoryDoc | undefined {
    return id ? this.categorias().find((c) => c.id === id) : undefined;
  }

  protected nomeCat(id: string | null): string {
    return id ? (this.cat(id)?.name ?? id) : 'Sem categoria';
  }

  /** "mar 2027" a partir de AAAA-MM. */
  protected mesCurto(mes: string): string {
    return `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
  }

  protected dataCurta(iso: string): string {
    return `${Number(iso.slice(8))} ${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}`;
  }

  protected pct(v: number): string {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  private carregar(): Promise<void> {
    return this.progresso.acompanhar(this.carregarDados());
  }

  private async carregarDados(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    try {
      const [txs, cats, contas] = await Promise.all([
        this.txRepo.listRange(
          uid,
          previousMonths(this.month, 6).at(-1) as string,
          this.month,
        ),
        this.catalog.categories(uid),
        // Sem as contas, tudo vira conta fixa; melhor que não mostrar nada.
        this.catalog.accounts(uid).catch(() => []),
      ]);
      this.cartoes.set(
        new Set(contas.filter((c) => c.type === 'cartao').map((c) => c.id)),
      );
      this.historico.set(
        (await marcarTransferencias(this.txRepo, uid, txs)).txs,
      );
      this.categorias.set(cats);
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Tente de novo em instantes.',
      );
    } finally {
      this.carregando.set(false);
    }
  }
}
