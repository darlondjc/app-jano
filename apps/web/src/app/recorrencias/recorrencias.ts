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
} from '@jano/ui';
import { Progresso } from '../shell/progresso';
import { mesAtual, rotuloMes } from '../transacoes/agrupar';
import { marcarTransferencias } from '../transacoes/transferencias';
import {
  montarRecorrencias,
  totalMensal,
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
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Recorrências: assinaturas, contas fixas e entradas que se repetem todo mês. */
@Component({
  selector: 'jano-recorrencias',
  imports: [
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
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
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
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 24px;
      align-items: start;
    }
    .cab,
    .linha {
      display: grid;
      grid-template-columns: minmax(0, 2.4fr) 1fr 0.7fr 1fr 1.2fr;
      gap: 12px;
      align-items: center;
      padding: 12px 16px;
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
    .calendario {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      text-align: center;
    }
    .calendario .sem {
      font: 500 11px/16px var(--font-sans);
      color: var(--text-2);
      text-transform: uppercase;
    }
    .dia {
      min-height: 44px;
      padding: 4px 0;
      border-radius: var(--radius-sm);
      font: 400 13px/16px var(--font-sans);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .dia.hoje {
      background: var(--primary-soft);
      color: var(--primary-text);
      font-weight: 600;
    }
    .dia.tem {
      border: 1px solid var(--border);
    }
    .pontos {
      display: flex;
      gap: 3px;
    }
    .pontos i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--danger);
    }
    .pontos i.entrada {
      background: var(--positive);
    }
    .legenda {
      margin-top: 12px;
      display: flex;
      gap: 16px;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    .legenda i {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
      background: var(--danger);
    }
    .legenda i.entrada {
      background: var(--positive);
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
    <h1>Recorrências</h1>
    <div class="j-sub">
      Assinaturas, contas fixas e entradas que se repetem todo mês.
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
          <jano-skeleton-card altura="220px" />
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
          <span class="j-cap">{{
            plural(qtd('gasto'), 'cobrança detectada', 'cobranças detectadas')
          }}</span>
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
          @for (l of linhas(); track l.tipo + l.nome) {
            <div class="linha">
              <div class="quem">
                <jano-category-badge
                  [icon]="cat(l.categoryId)?.icon ?? 'etiqueta'"
                  [colorToken]="cat(l.categoryId)?.color ?? 'cat-1'"
                  [size]="32"
                />
                <div>
                  <b>{{ l.nome }}</b>
                  <span class="sub"
                    >{{
                      l.tipo === 'entrada' ? 'Entrada' : nomeCat(l.categoryId)
                    }}
                    · {{ l.meses }} meses</span
                  >
                </div>
              </div>
              <div [class]="'valor' + (l.tipo === 'entrada' ? ' entrada' : '')">
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
        </section>

        <section class="j-card" aria-label="Calendário do mês">
          <h2>{{ mes }}</h2>
          <div
            class="calendario"
            role="grid"
            [attr.aria-label]="'Calendário de ' + mes"
          >
            @for (d of semana; track d) {
              <span class="sem" aria-hidden="true">{{ d }}</span>
            }
            @for (v of vazios(); track $index) {
              <span aria-hidden="true"></span>
            }
            @for (d of dias(); track d.n) {
              <div
                role="gridcell"
                [class]="
                  'dia' +
                  (d.hoje ? ' hoje' : '') +
                  (d.itens.length ? ' tem' : '')
                "
                [attr.title]="d.titulo"
                [attr.aria-label]="d.titulo || null"
              >
                {{ d.n }}
                @if (d.itens.length) {
                  <span class="pontos" aria-hidden="true">
                    @for (i of d.itens; track i.nome) {
                      <i [class]="i.tipo"></i>
                    }
                  </span>
                }
              </div>
            }
          </div>
          <div class="legenda">
            <span><i></i>Cobrança</span>
            <span><i class="entrada"></i>Entrada</span>
          </div>
        </section>
      </div>
    }

    <ng-template #etq let-l="l">
      @if (l.reajustada) {
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

  protected readonly money = formatBRL;
  protected readonly semana = DIAS_SEMANA;
  private readonly hoje = new Date();
  private readonly month = mesAtual(this.hoje);
  protected readonly mes = rotuloMes(this.month);

  private readonly historico = signal<TransactionDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly linhas = computed<LinhaRecorrencia[]>(() =>
    montarRecorrencias(
      this.historico(),
      `${this.month}-${String(this.hoje.getDate()).padStart(2, '0')}`,
    ),
  );
  protected readonly totalGastos = computed(() =>
    totalMensal(this.linhas(), 'gasto'),
  );
  protected readonly totalEntradas = computed(() =>
    totalMensal(this.linhas(), 'entrada'),
  );
  protected readonly reajustadas = computed(
    () => this.linhas().filter((l) => l.reajustada).length,
  );

  // Calendário do mês atual (domingo primeiro).
  private readonly diasNoMes = new Date(
    this.hoje.getFullYear(),
    this.hoje.getMonth() + 1,
    0,
  ).getDate();
  protected readonly vazios = computed(() =>
    Array.from(
      {
        length: new Date(
          this.hoje.getFullYear(),
          this.hoje.getMonth(),
          1,
        ).getDay(),
      },
      (_, i) => i,
    ),
  );
  protected readonly dias = computed(() =>
    Array.from({ length: this.diasNoMes }, (_, i) => {
      const n = i + 1;
      const itens = this.linhas().filter(
        (l) => Math.min(l.day, this.diasNoMes) === n,
      );
      return {
        n,
        hoje: n === this.hoje.getDate(),
        itens,
        titulo: itens
          .map(
            (l) =>
              `${l.nome} (${l.tipo === 'entrada' ? '+' : '−'}${formatBRL(l.cents)})`,
          )
          .join(', '),
      };
    }),
  );

  constructor() {
    void this.carregar();
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
      const [txs, cats] = await Promise.all([
        this.txRepo.listRange(
          uid,
          previousMonths(this.month, 6).at(-1) as string,
          this.month,
        ),
        this.catalog.categories(uid),
      ]);
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
