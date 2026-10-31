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
  BalancesRepository,
  BudgetsRepository,
  CatalogRepository,
  ContaRepository,
  InsightsRepository,
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
  limitesComSobra,
  monthPace,
  monthTotals,
  previousMonths,
  projectMonthEnd,
  tightestGoals,
  valoresOcultos,
} from '@jano/engine';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoGoalBar,
  JanoKpiCard,
  JanoSkeletonCard,
  JanoSkeletonGroup,
  JanoSkeletonKpi,
  JanoSkeletonRows,
} from '@jano/ui';
import { classeValor, mesAtual, rotuloMes } from '../transacoes/agrupar';
import { marcarTransferencias } from '../transacoes/transferencias';
import { montarAlertas } from './alertas';
import { GraficoAcumulado } from './grafico-acumulado';
import { Progresso } from '../shell/progresso';
import { haQuantoTempo } from '../conta/tempo';
import { deveLembrar } from './lembrete';
import { saldoAtual, type SaldoAtual } from './saldo';
import { podeGastar, type PodeGastar } from './pode-gastar';
import { comparacaoNoDia, variacao } from './comparacao';
import { faturaDoCartao, type FaturaCartao } from './fatura';
import { inicioParaRevisar, precisaRevisar } from '../transacoes/filtrar';

function hojeIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CHAVE_LEMBRETE = 'jano.lembreteImportacao';

function lerDispensado(): string | null {
  try {
    return localStorage.getItem(CHAVE_LEMBRETE);
  } catch {
    return null;
  }
}

@Component({
  selector: 'jano-inicio',
  imports: [
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoGoalBar,
    JanoKpiCard,
    JanoCategoryBadge,
    JanoSkeletonCard,
    JanoSkeletonGroup,
    JanoSkeletonKpi,
    JanoSkeletonRows,
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
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
    }
    .titulo-secao {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .destaque {
      margin-top: 20px;
    }
    .fatura {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .fatura h2 {
      margin: 0;
    }
    .fatura-linha {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .fatura-linha + .fatura-linha {
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .fatura-valor {
      font: 600 22px/28px var(--font-sans);
    }
    /* Celular, em duas colunas: com número ímpar de indicadores, o último ocupa a linha. */
    @media (max-width: 599px) {
      .kpis > :last-child:nth-child(odd) {
        grid-column: 1 / -1;
      }
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
      <div>
        <h1>Como está seu mês</h1>
        <div class="j-sub">
          Olá, {{ nome() }} · dia {{ diaAtual }} de {{ diasNoMes }} ·
          {{ mes() }}
        </div>
      </div>
    </header>

    @if (erro()) {
      <jano-banner tone="danger" title="Não consegui carregar seus dados.">{{
        erro()
      }}</jano-banner>
    }

    @if (lembrete(); as quando) {
      <jano-banner
        tone="info"
        title="Hora de atualizar seus dados."
        style="display: block; margin-top: 12px"
      >
        Última importação {{ quando }}.
        <a
          janoButton
          variant="secondary"
          [small]="true"
          routerLink="/transacoes"
          >Importar novo extrato</a
        >
        <button
          janoButton
          variant="ghost"
          [small]="true"
          type="button"
          (click)="dispensarLembrete()"
        >
          Agora não
        </button>
      </jano-banner>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando seu mês">
        <section class="kpis j-kpis-2col">
          @for (n of [1, 2, 3, 4]; track n) {
            <jano-skeleton-kpi />
          }
        </section>
        <div class="colunas">
          <div class="principal">
            <jano-skeleton-card altura="240px" />
            <jano-skeleton-rows [count]="6" />
          </div>
          <div class="lateral">
            <jano-skeleton-card altura="160px" />
          </div>
        </div>
      </jano-skeleton-group>
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
      @if (saldo(); as s) {
        <section
          class="j-hero destaque"
          aria-label="Saldo e quanto dá para gastar"
        >
          <div class="j-hero__label">
            {{ s.legenda }} · atualizado {{ quando(s.atualizadoEm) }}
          </div>
          <div class="j-hero__valor j-num">
            @if (oculto()) {
              R$ ••••••
            } @else {
              {{ s.cents < 0 ? '−' : '' }}R$ {{ reais(s.cents)
              }}<small>,{{ centavos(s.cents) }}</small>
            }
          </div>
          <div
            class="j-hero__mes"
            role="img"
            [attr.aria-label]="'Dia ' + diaAtual + ' de ' + diasNoMes"
          >
            <span [style.width.%]="pace * 100"></span>
          </div>
          @if (gastar(); as g) {
            <div class="j-hero__linha">
              <div>
                <div class="j-hero__label">
                  Pode gastar até o salário ({{ diaMes(g.salario) }})
                </div>
                <div class="j-hero__destaque">
                  {{ reaisInteiros(g.porDiaCents) }} por dia
                </div>
              </div>
              <div class="j-hero__label">
                {{
                  g.dias === 1 ? 'falta 1 dia' : 'faltam ' + g.dias + ' dias'
                }}
              </div>
              <div class="j-hero__nota" style="flex-basis: 100%">
                {{ explicacao(g) }}
              </div>
            </div>
          }
        </section>
      }
      <section class="kpis j-kpis-2col" aria-label="Resumo do mês">
        @if (!saldo()) {
          <jano-kpi-card
            label="Sobra do mês"
            [valueCents]="totais().net"
            tone="auto"
          />
        }
        <jano-kpi-card
          label="Gasto no mês"
          [valueCents]="totais().spent"
          [serie]="comparacao().gastos"
          corTendencia="text-2"
        >
          @if (variacaoGasto(); as v) {
            <div>
              <span [class]="'j-delta j-delta--' + v.tom">{{ v.texto }}</span>
            </div>
          }
        </jano-kpi-card>
        <jano-kpi-card
          label="Receitas"
          [valueCents]="totais().income"
          tone="in"
          [serie]="comparacao().receitas"
          corTendencia="positive"
        >
          @if (variacaoReceita(); as v) {
            <div>
              <span [class]="'j-delta j-delta--' + v.tom">{{ v.texto }}</span>
            </div>
          }
        </jano-kpi-card>
        <jano-kpi-card
          label="Sobra prevista no fechamento"
          [valueCents]="sobraPrevista()"
          tone="auto"
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
            <span class="j-cap"
              >Projeção para {{ diasNoMes }} de {{ mesCurto }}</span
            >
          }
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
          @if (faturaCartao(); as fc) {
            <section class="j-card fatura" aria-label="Fatura do cartão">
              <h2>Fatura do cartão</h2>
              <div class="fatura-linha">
                <div>
                  <div class="j-sub">Em aberto</div>
                  <div class="fatura-valor j-num">
                    {{ money(fc.abertaCents) }}
                  </div>
                </div>
                <span class="j-cap">
                  @if (fc.vence) {
                    vence {{ diaMes(fc.vence) }}
                  } @else {
                    vencimento a confirmar
                  }
                </span>
              </div>
              @if (fc.proximaCents) {
                <div class="fatura-linha">
                  <div>
                    <div class="j-sub">Próxima, já garantida</div>
                    <div class="fatura-valor j-num">
                      {{ money(fc.proximaCents) }}
                    </div>
                  </div>
                </div>
                <p class="j-cap" style="margin: -4px 0 0">
                  {{ composicaoFatura(fc) }}, mais o que você comprar no cartão
                  até o fechamento.
                </p>
              }
            </section>
          }
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
                    @if (a.id === 'revisar' && a.acao; as ac) {
                      <a
                        janoButton
                        variant="secondary"
                        [small]="true"
                        [routerLink]="ac.rota"
                        [queryParams]="ac.queryParams"
                        style="margin-top: 8px"
                        >{{ ac.rotulo }}</a
                      >
                    }
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
  private readonly contaRepo = inject(ContaRepository);
  private readonly balancesRepo = inject(BalancesRepository);
  private readonly insightsRepo = inject(InsightsRepository);
  /** Insights dispensados nas Avaliações neste mês. */
  private readonly dispensados = signal<ReadonlySet<string>>(new Set());

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
  /** Saldo do banco (Open Finance); sem sincronização, o primeiro KPI volta a ser a sobra do mês. */
  protected readonly saldo = signal<SaldoAtual | null>(null);
  /** Fatura em aberto dos cartões (positivo = devido), do banco. */
  private readonly fatura = signal(0);
  protected readonly oculto = valoresOcultos;
  protected readonly gastar = computed(() => {
    const s = this.saldo();
    if (!s) return null;
    const cartoes = this.cartoes();
    return podeGastar({
      saldoCents: s.cents,
      faturaCents: this.fatura(),
      // Compras do cartão já estão na fatura; recorrências só das contas.
      txs: this.historico().filter((t) => !cartoes.has(t.accountId)),
      hoje: hojeIso(this.hoje),
    });
  });
  protected readonly faturaCartao = computed(() =>
    faturaDoCartao({
      faturaCents: this.fatura(),
      txs: this.historico(),
      cartoes: this.cartoes(),
      hoje: hojeIso(this.hoje),
    }),
  );
  protected readonly comparacao = computed(() =>
    comparacaoNoDia(
      this.historico(),
      this.month,
      this.diaAtual,
      3,
      this.cartoes(),
    ),
  );
  protected readonly variacaoGasto = computed(() =>
    variacao(this.comparacao().gastos, previousMonths(this.month, 1)[0], false),
  );
  protected readonly variacaoReceita = computed(() =>
    variacao(
      this.comparacao().receitas,
      previousMonths(this.month, 1)[0],
      true,
    ),
  );
  protected reais(cents: number): string {
    return new Intl.NumberFormat('pt-BR').format(
      Math.trunc(Math.abs(cents) / 100),
    );
  }
  protected centavos(cents: number): string {
    return String(Math.abs(cents) % 100).padStart(2, '0');
  }
  /** "R$ 1.853": o valor por dia não precisa de centavos. */
  protected reaisInteiros(cents: number): string {
    return this.oculto()
      ? formatBRL(cents)
      : `R$ ${new Intl.NumberFormat('pt-BR').format(Math.floor(cents / 100))}`;
  }
  protected explicacao(g: PodeGastar): string {
    const partes = [
      g.faturaCents ? `a fatura do cartão (${formatBRL(g.faturaCents)})` : '',
      g.contasCents
        ? `as contas fixas até lá (${formatBRL(g.contasCents)})`
        : '',
    ].filter(Boolean);
    if (!partes.length) return 'Saldo das contas dividido pelos dias até lá.';
    const lista = partes.join(' e ');
    return g.livreCents > 0
      ? `Saldo menos ${lista}.`
      : `${lista[0].toUpperCase()}${lista.slice(1)} passam do saldo em ${formatBRL(-g.livreCents)}.`;
  }
  protected composicaoFatura(fc: FaturaCartao): string {
    const partes = [
      fc.parcelasCents
        ? `${fc.nParcelas === 1 ? '1 parcela' : `${fc.nParcelas} parcelas`} (${formatBRL(fc.parcelasCents)})`
        : '',
      fc.assinaturasCents
        ? `assinaturas (${formatBRL(fc.assinaturasCents)})`
        : '',
    ].filter(Boolean);
    const texto = partes.join(' e ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  protected diaMes(iso: string): string {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  }
  protected readonly quando = haQuantoTempo;

  protected readonly cartoes = signal<ReadonlySet<string>>(new Set());
  private readonly ultimaImportacao = signal<string | null>(null);
  private readonly dispensadoEm = signal<string | null>(lerDispensado());
  protected readonly lembrete = computed(() => {
    const ultima = this.ultimaImportacao();
    return ultima && deveLembrar(ultima, new Date(), this.dispensadoEm())
      ? haQuantoTempo(ultima)
      : null;
  });
  protected readonly totais = computed(() =>
    monthTotals(this.txs(), this.cartoes()),
  );
  /** Metas com a sobra do mês anterior (rollover); sem dados do mês anterior, sem folga. */
  private readonly metas = computed(() => {
    const anterior = previousMonths(this.month, 1)[0];
    const doAnterior = this.historico().filter((t) =>
      t.date.startsWith(anterior),
    );
    return limitesComSobra(
      this.budgets(),
      doAnterior.length
        ? monthTotals(doAnterior, this.cartoes()).spentByCategory
        : null,
    );
  });
  protected readonly linhasMetas = computed(() =>
    budgetRows(this.metas(), this.totais().spentByCategory),
  );
  protected readonly apertadas = computed(() =>
    tightestGoals(this.linhasMetas(), 4),
  );
  protected readonly limiteTotal = computed(() => {
    const soma = this.metas().reduce((s, b) => s + b.limitCents, 0);
    return soma > 0 ? soma : null;
  });
  protected readonly gastoProjetado = computed(() =>
    projectMonthEnd(this.totais().spent, this.pace),
  );
  protected readonly sobraPrevista = computed(
    () => this.totais().income - this.gastoProjetado(),
  );
  protected readonly serie = computed(() =>
    cumulativeSpend(this.txs(), this.diaAtual, this.cartoes()),
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
      budgets: this.metas(),
      spentByCategory: this.totais().spentByCategory,
      daysLeft: this.diasRestantes,
      assinaturasId: this.cat('assinaturas')?.id ?? null,
      nomeCategoria: (id) => this.nomeCategoria(id),
      moeda: formatBRL,
      dispensados: this.dispensados(),
      paraRevisar: this.historico().filter((t) =>
        precisaRevisar(t, inicioParaRevisar(this.hoje)),
      ).length,
    }),
  );

  constructor() {
    void this.carregar();
  }

  protected dispensarLembrete(): void {
    const agora = new Date().toISOString();
    this.dispensadoEm.set(agora);
    try {
      localStorage.setItem(CHAVE_LEMBRETE, agora);
    } catch {
      // Sem armazenamento: some só nesta visita.
    }
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
      const [txs, budgets, cats, contas, saldos, dispensados] =
        await Promise.all([
          this.txRepo.listRange(
            uid,
            previousMonths(this.month, 3).at(-1) as string,
            this.month,
          ),
          this.budgetRepo.list(uid),
          this.catalog.categories(uid),
          this.catalog.accounts(uid),
          // Só alimenta o KPI de saldo: se falhar, o resto da tela segue normal.
          this.balancesRepo.list(uid).catch(() => []),
          this.insightsRepo.dispensados(uid, this.month).catch(() => []),
        ]);
      this.dispensados.set(new Set(dispensados));
      this.saldo.set(saldoAtual(saldos));
      this.fatura.set(
        saldos
          .filter((b) => b.kind === 'cartao')
          .reduce((soma, b) => soma + Math.max(0, b.balanceCents), 0),
      );
      this.cartoes.set(
        new Set(contas.filter((c) => c.type === 'cartao').map((c) => c.id)),
      );
      // Só alimenta o lembrete: se falhar, o resto da tela segue normal.
      this.ultimaImportacao.set(
        await this.contaRepo
          .ultimaImportacao(uid)
          .then((r) => r?.createdAt ?? null)
          .catch(() => null),
      );
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
