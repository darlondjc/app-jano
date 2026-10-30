import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AuthService,
  BudgetsRepository,
  CatalogRepository,
  TransactionsRepository,
  type BudgetDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import {
  budgetRows,
  cumulativeSpend,
  daysLeftInMonth,
  formatBRL,
  monthPace,
  monthTotals,
  previousMonths,
  projectMonthEnd,
  tightestGoals,
} from '@jano/engine';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoGoalBar,
  JanoKpiCard,
} from '@jano/ui';
import { classeValor, mesAtual, rotuloMes } from '../transacoes/agrupar';
import { marcarTransferencias } from '../transacoes/transferencias';
import { montarAlertas } from './alertas';
import { GraficoAcumulado } from './grafico-acumulado';
import { Progresso } from '../shell/progresso';

@Component({
  selector: 'jano-inicio',
  imports: [
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoGoalBar,
    JanoKpiCard,
    JanoCategoryBadge,
    GraficoAcumulado,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    h2 {
      margin: 0;
      font: 600 18px/24px var(--font-sans);
    }
    .titulo-secao {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .colunas {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: flex-start;
      margin-top: 24px;
    }
    .principal {
      flex: 999 1 520px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .lateral {
      flex: 1 1 340px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .alertas {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .alertas h2 {
      margin-bottom: 4px;
    }
    .lista {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .lista .j-tx:last-child {
      border-bottom: 0;
    }
    .metas {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .vazio {
      margin-top: 24px;
    }
    .vazio-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
  `,
  template: `
    <header>
      <h1>Como está seu mês</h1>
      <div class="j-sub">
        Olá, {{ nome() }} · dia {{ diaAtual }} de {{ diasNoMes }} ·
        {{ mes() }}
      </div>
    </header>

    @if (erro()) {
      <jano-banner tone="danger" title="Não consegui carregar seus dados.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <p class="j-sub vazio">Carregando seu mês...</p>
    } @else if (!txs().length) {
      <div class="j-card vazio">
        <h2 style="margin: 0 0 8px">Vamos começar</h2>
        <p class="j-sub" style="margin: 0 0 16px">
          Seu mês aparece aqui assim que você importar o extrato (OFX) da conta
          ou a fatura do cartão (PDF).
        </p>
        <a janoButton variant="primary" routerLink="/transacoes">Importar</a>
      </div>
    } @else {
      <section class="kpis j-kpis-2col" aria-label="Resumo do mês">
        <jano-kpi-card
          label="Sobra do mês"
          [valueCents]="totais().net"
          tone="auto"
        >
          <span class="j-cap">receitas menos gastos até agora</span>
        </jano-kpi-card>
        <jano-kpi-card
          label="Gasto no mês"
          [valueCents]="totais().spent"
          tone="out"
        >
          @if (statusMeta(); as s) {
            <div>
              <span
                [class]="'j-delta j-delta--' + (s.noRitmo ? 'good' : 'bad')"
              >
                {{ s.pct }}% da meta ·
                {{ s.noRitmo ? 'abaixo do ritmo' : 'acima do ritmo' }}
              </span>
            </div>
          } @else {
            <span class="j-cap">tudo que saiu no mês, sem transferências</span>
          }
        </jano-kpi-card>
        <jano-kpi-card
          label="Receitas"
          [valueCents]="totais().income"
          tone="in"
        >
          <span class="j-cap">tudo que entrou no mês, sem transferências</span>
        </jano-kpi-card>
        <jano-kpi-card
          label="Sobra prevista no fechamento"
          [valueCents]="sobraPrevista()"
          tone="auto"
        >
          <span class="j-cap"
            >Projeção para {{ diasNoMes }} de {{ mesCurto }}</span
          >
        </jano-kpi-card>
      </section>

      <div class="colunas">
        <div class="principal">
          <section class="j-card" aria-label="Gasto acumulado">
            <h2>Gasto acumulado no mês</h2>
            <p class="j-sub" style="margin: 4px 0 0">{{ resumoRitmo() }}</p>
            <jano-grafico-acumulado
              [serie]="serie()"
              [dias]="diasNoMes"
              [limite]="limiteTotal()"
              [projecao]="gastoProjetado()"
            />
          </section>

          <section aria-label="Últimas transações">
            <div class="titulo-secao">
              <h2>Últimas transações</h2>
              <a
                janoButton
                variant="ghost"
                [small]="true"
                routerLink="/transacoes"
                >Ver todas ›</a
              >
            </div>
            <div class="lista">
              @for (t of recentes(); track t.id) {
                <div class="j-tx" style="grid-template-columns: auto 1fr auto">
                  <jano-category-badge
                    [icon]="cat(t.categoryId)?.icon ?? 'etiqueta'"
                    [colorToken]="cat(t.categoryId)?.color ?? 'cat-1'"
                    [size]="32"
                  />
                  <div>
                    <div class="j-tx__name">{{ t.description }}</div>
                    <div class="j-tx__sub">
                      {{ dia(t.date) }} ·
                      {{
                        t.isTransfer
                          ? 'Transferência'
                          : nomeCategoria(t.categoryId)
                      }}
                    </div>
                  </div>
                  <div [class]="classeValor(t)">
                    {{ t.amountCents > 0 ? '+' : '' }}{{ money(t.amountCents) }}
                  </div>
                </div>
              }
            </div>
          </section>
        </div>

        <div class="lateral">
          @if (alertas().length) {
            <section class="alertas" aria-label="Alertas">
              <h2>Para ver hoje</h2>
              @for (a of alertas(); track a.titulo) {
                <div class="j-insight">
                  <div
                    class="j-insight__icon"
                    [style.background]="
                      a.tom === 'warn'
                        ? 'var(--warning-soft)'
                        : 'var(--info-soft)'
                    "
                    [style.color]="
                      a.tom === 'warn' ? 'var(--warning-text)' : 'var(--info)'
                    "
                  >
                    @if (a.tom === 'warn') {
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 3L22 20H2Z"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M12 10V14M12 17V17.5"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      </svg>
                    } @else {
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <path
                          d="M12 8V12.5M12 16V16.1"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      </svg>
                    }
                  </div>
                  <div>
                    <div class="j-insight__title">{{ a.titulo }}</div>
                    <div class="j-insight__text">{{ a.texto }}</div>
                  </div>
                </div>
              }
            </section>
          }

          <section class="j-card" aria-label="Metas por categoria">
            <div class="titulo-secao">
              <h2>Orçamento</h2>
              <a
                janoButton
                variant="ghost"
                [small]="true"
                routerLink="/orcamento"
                >Ver todas ›</a
              >
            </div>
            @if (apertadas().length) {
              <div class="metas">
                @for (m of apertadas(); track m.categoryId) {
                  <jano-goal-bar
                    [plain]="true"
                    [name]="nomeCategoria(m.categoryId)"
                    [spentCents]="m.spentCents"
                    [limitCents]="m.limitCents"
                    [pace]="pace"
                    [daysLeft]="diasRestantes"
                  />
                }
              </div>
            } @else {
              <div class="vazio-meta">
                <span class="j-sub">Você ainda não definiu metas.</span>
                <a
                  janoButton
                  variant="secondary"
                  [small]="true"
                  routerLink="/orcamento"
                  >Criar a primeira meta</a
                >
              </div>
            }
          </section>
        </div>
      </div>
    }
  `,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly progresso = inject(Progresso);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);

  protected readonly money = formatBRL;
  protected readonly classeValor = classeValor;
  private readonly hoje = new Date();
  private readonly month = mesAtual(this.hoje);
  protected readonly mes = computed(() => rotuloMes(this.month));
  protected readonly mesCurto = rotuloMes(this.month)
    .split(' ')[0]
    .toLowerCase();
  protected readonly diaAtual = this.hoje.getDate();
  protected readonly diasNoMes = new Date(
    this.hoje.getFullYear(),
    this.hoje.getMonth() + 1,
    0,
  ).getDate();
  protected readonly pace = monthPace(
    this.hoje.getFullYear(),
    this.hoje.getMonth() + 1,
    this.diaAtual,
  );
  protected readonly diasRestantes = daysLeftInMonth(
    this.hoje.getFullYear(),
    this.hoje.getMonth() + 1,
    this.diaAtual,
  );

  /** Mês atual e os três anteriores: o histórico alimenta os alertas. */
  private readonly historico = signal<TransactionDoc[]>([]);
  protected readonly txs = computed(() =>
    this.historico().filter((t) => t.date.startsWith(this.month)),
  );
  private readonly budgets = signal<BudgetDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly totais = computed(() => monthTotals(this.txs()));
  protected readonly linhasMetas = computed(() =>
    budgetRows(this.budgets(), this.totais().spentByCategory),
  );
  protected readonly apertadas = computed(() =>
    tightestGoals(this.linhasMetas(), 4),
  );
  protected readonly limiteTotal = computed(() => {
    const soma = this.budgets().reduce((s, b) => s + b.limitCents, 0);
    return soma > 0 ? soma : null;
  });
  protected readonly gastoProjetado = computed(() =>
    projectMonthEnd(this.totais().spent, this.pace),
  );
  protected readonly sobraPrevista = computed(
    () => this.totais().income - this.gastoProjetado(),
  );
  protected readonly serie = computed(() =>
    cumulativeSpend(this.txs(), this.diaAtual),
  );
  protected readonly statusMeta = computed(() => {
    const limite = this.limiteTotal();
    if (!limite) return null;
    return {
      pct: Math.round((this.totais().spent / limite) * 100),
      noRitmo: this.totais().spent <= limite * this.pace,
    };
  });
  protected readonly resumoRitmo = computed(() => {
    const limite = this.limiteTotal();
    if (!limite)
      return 'Defina metas no Orçamento para ver o ritmo ideal de gasto.';
    const ideal = Math.round(limite * this.pace);
    const dif = this.totais().spent - ideal;
    return dif <= 0
      ? `Você está ${formatBRL(-dif)} abaixo do ritmo ideal para o dia ${this.diaAtual}.`
      : `Você está ${formatBRL(dif)} acima do ritmo ideal para o dia ${this.diaAtual}.`;
  });
  protected readonly recentes = computed(() =>
    [...this.txs()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
  );
  protected readonly alertas = computed(() =>
    montarAlertas({
      txs: this.historico(),
      month: this.month,
      today: `${this.month}-${String(this.diaAtual).padStart(2, '0')}`,
      budgets: this.budgets(),
      spentByCategory: this.totais().spentByCategory,
      daysLeft: this.diasRestantes,
      assinaturasId: this.cat('assinaturas')?.id ?? null,
      nomeCategoria: (id) => this.nomeCategoria(id),
      moeda: formatBRL,
    }),
  );

  constructor() {
    void this.carregar();
  }

  protected nome(): string {
    return this.auth.user()?.displayName?.split(' ')[0] ?? '';
  }

  protected cat(id: string | null): CategoryDoc | undefined {
    return id ? this.categorias().find((c) => c.id === id) : undefined;
  }

  protected nomeCategoria(id: string | null): string {
    return id
      ? (this.categorias().find((c) => c.id === id)?.name ?? id)
      : 'Sem categoria';
  }

  protected dia(date: string): string {
    const [, m, d] = date.split('-');
    return `${Number(d)}/${m}`;
  }

  private carregar(): Promise<void> {
    return this.progresso.acompanhar(this.carregarDados());
  }

  private async carregarDados(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    try {
      const [txs, budgets, cats] = await Promise.all([
        this.txRepo.listRange(
          uid,
          previousMonths(this.month, 3).at(-1) as string,
          this.month,
        ),
        this.budgetRepo.list(uid),
        this.catalog.categories(uid),
      ]);
      this.historico.set(
        (await marcarTransferencias(this.txRepo, uid, txs)).txs,
      );
      this.budgets.set(budgets);
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
