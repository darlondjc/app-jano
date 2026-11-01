import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { nomeDeExibicao } from '@jano/import-file';
import { PeriodoService } from '../periodo/periodo.service';
import {
  AuthService,
  BalancesRepository,
  BudgetsRepository,
  CatalogRepository,
  ContaRepository,
  InsightsRepository,
  TransactionsRepository,
  type BalanceDoc,
  type BudgetDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import {
  budgetRows,
  calendario,
  contasDoMes,
  diaNoPeriodo,
  diasNoPeriodo,
  monthOf,
  cumulativeSpend,
  daysLeftInMonth,
  formatBRL,
  limitesComSobra,
  monthPace,
  monthTotals,
  previousMonths,
  previsaoDoMes,
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
import {
  classeValor,
  mesAtual,
  rotuloMes,
  rotuloTransferencia,
} from '../transacoes/agrupar';
import { marcarTransferencias } from '../transacoes/transferencias';
import { montarAlertas } from './alertas';
import { GraficoAcumulado } from './grafico-acumulado';
import { Progresso } from '../shell/progresso';
import { haQuantoTempo } from '../conta/tempo';
import { deveLembrar } from './lembrete';
import { saldoAtual, type SaldoAtual } from './saldo';
import { podeGastar, type PodeGastar } from './pode-gastar';
import { comparacaoNoDia, variacao } from './comparacao';
import { cartaoDaFatura, type DiasDaFatura } from './fatura';
import { FaturaCartaoCard } from './fatura-cartao';

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
    FaturaCartaoCard,
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
      flex-direction: column;
      gap: 24px;
      margin-top: 24px;
    }
    /* No celular as colunas somem e cada bloco entra na ordem do que pede decisão. */
    .principal,
    .lateral {
      display: contents;
    }
    .ordem-1 {
      order: 1;
    }
    .ordem-2 {
      order: 2;
    }
    .ordem-3 {
      order: 3;
    }
    .ordem-4 {
      order: 4;
    }
    .ordem-5 {
      order: 5;
    }
    @media (min-width: 900px) {
      .colunas {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
        align-items: start;
      }
      .principal,
      .lateral {
        display: flex;
        flex-direction: column;
        gap: 24px;
        min-width: 0;
      }
    }
    .sem-mes {
      margin: -4px 0 12px;
    }
    .acao {
      display: inline-block;
      margin-top: 6px;
      color: var(--primary-text);
      font: 600 13px/18px var(--font-sans);
      text-decoration: none;
    }
    .acao:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
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
          Olá, {{ nome() }} · dia {{ diaAtual() }} de {{ diasNoMes() }} ·
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
    } @else if (!historico().length) {
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
            [attr.aria-label]="'Dia ' + diaAtual() + ' de ' + diasNoMes()"
          >
            <span [style.width.%]="pace() * 100"></span>
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
          [label]="periodo.peloSalario() ? 'Gasto no período' : 'Gasto no mês'"
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
            <span class="j-cap">Projeção até {{ fimDoPeriodo() }}</span>
          }
        </jano-kpi-card>
      </section>

      <!-- Celular: uma coluna na ordem do que pede decisão (ver .ordem-N);
           desktop: duas colunas equilibradas. -->
      <div class="colunas">
        <div class="principal">
          @if (alertas().length) {
            <section class="alertas ordem-1" aria-label="Alertas">
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
                    @if (a.acao; as ac) {
                      <a
                        class="acao"
                        [routerLink]="ac.rota"
                        [queryParams]="ac.queryParams"
                        >{{ ac.rotulo }} ›</a
                      >
                    }
                  </div>
                </div>
              }
            </section>
          }

          <section class="j-card ordem-4" aria-label="Gasto acumulado">
            <h2>
              {{
                periodo.peloSalario()
                  ? 'Gasto acumulado no período'
                  : 'Gasto acumulado no mês'
              }}
            </h2>
            <p class="j-sub" style="margin: 4px 0 0">{{ resumoRitmo() }}</p>
            <jano-grafico-acumulado
              [serie]="serie()"
              [dias]="diasNoMes()"
              [limite]="limiteTotal()"
              [projecao]="gastoProjetado()"
            />
          </section>

          <section class="ordem-5" aria-label="Últimas transações">
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
            @if (!txs().length) {
              <p class="j-sub sem-mes">
                Nada neste período ainda; a sincronização diária traz os
                lançamentos novos. Abaixo, os mais recentes.
              </p>
            }
            <div class="lista">
              @for (t of recentes(); track t.id) {
                <div class="j-tx" style="grid-template-columns: auto 1fr auto">
                  <jano-category-badge
                    [icon]="cat(t.categoryId)?.icon ?? 'etiqueta'"
                    [colorToken]="cat(t.categoryId)?.color ?? 'cat-1'"
                    [size]="32"
                  />
                  <div>
                    <div class="j-tx__name" [title]="t.description">
                      {{ nomeTx(t.description) }}
                    </div>
                    <div class="j-tx__sub">
                      {{ dia(t.date) }} ·
                      {{
                        t.isTransfer
                          ? rotuloTransferencia(t)
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
            <jano-fatura-cartao
              class="ordem-2"
              [fatura]="fc"
              [categorias]="categorias()"
              [salvandoDias]="salvandoDias()"
              (salvarDias)="salvarDiasDaFatura(fc.accountId, $event)"
            />
          }

          <section class="j-card ordem-3" aria-label="Metas por categoria">
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
                    [pace]="pace()"
                    [daysLeft]="diasRestantes()"
                    [conta]="contas().get(m.categoryId)"
                    [ritmoNoTexto]="false"
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
  protected readonly periodo = inject(PeriodoService);
  /** Insights dispensados nas Avaliações neste mês. */
  private readonly dispensados = signal<ReadonlySet<string>>(new Set());

  protected readonly money = formatBRL;
  protected readonly classeValor = classeValor;
  private readonly hoje = new Date();
  /** Período financeiro atual ('AAAA-MM'); vale o mês até o salário ser conhecido. */
  private readonly month = signal(mesAtual(this.hoje));
  protected readonly mes = computed(() =>
    this.periodo.peloSalario()
      ? this.periodo.rotulo(this.month())
      : rotuloMes(this.month()),
  );
  protected readonly diaAtual = signal(this.hoje.getDate());
  protected readonly diasNoMes = signal(
    new Date(this.hoje.getFullYear(), this.hoje.getMonth() + 1, 0).getDate(),
  );
  protected readonly pace = signal(
    monthPace(
      this.hoje.getFullYear(),
      this.hoje.getMonth() + 1,
      this.hoje.getDate(),
    ),
  );
  protected readonly diasRestantes = signal(
    daysLeftInMonth(
      this.hoje.getFullYear(),
      this.hoje.getMonth() + 1,
      this.hoje.getDate(),
    ),
  );
  /** "4 de nov": último dia do período. */
  protected readonly fimDoPeriodo = computed(() => {
    const fim = calendario().fim(this.month());
    return `${Number(fim.slice(8, 10))} de ${rotuloMes(fim.slice(0, 7)).split(' ')[0].toLowerCase()}`;
  });
  /** "o anterior" com o período pelo salário; "set" com o mês do calendário. */
  private readonly nomeAnterior = computed(() =>
    this.periodo.peloSalario() ? 'o anterior' : undefined,
  );

  /** Mês atual e os três anteriores: o histórico alimenta os alertas. */
  protected readonly historico = signal<TransactionDoc[]>([]);
  protected readonly txs = computed(() =>
    this.historico().filter((t) => monthOf(t.date) === this.month()),
  );
  private readonly budgets = signal<BudgetDoc[]>([]);
  protected readonly categorias = signal<CategoryDoc[]>([]);
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
      // Com os dias informados, desconta a fatura do ciclo, não o saldo com parcelas futuras.
      faturaCents: this.faturaCartao()?.diasInformados
        ? (this.faturaCartao()?.valorCents ?? 0)
        : this.fatura(),
      // Compras do cartão já estão na fatura; recorrências só das contas.
      txs: this.historico().filter((t) => !cartoes.has(t.accountId)),
      hoje: hojeIso(this.hoje),
    });
  });
  private readonly saldos = signal<BalanceDoc[]>([]);
  /** Dias de fechamento e vencimento informados, por conta de cartão. */
  private readonly diasDosCartoes = signal(new Map<string, DiasDaFatura>());
  protected readonly salvandoDias = signal(false);
  protected readonly faturaCartao = computed(() => {
    const saldos = this.saldos();
    const id =
      saldos.find((b) => b.kind === 'cartao')?.accountId ??
      [...this.cartoes()][0];
    return cartaoDaFatura({
      saldos,
      txs: this.historico(),
      cartoes: this.cartoes(),
      hoje: hojeIso(this.hoje),
      dias: id ? (this.diasDosCartoes().get(id) ?? null) : null,
    });
  });

  protected async salvarDiasDaFatura(
    accountId: string | null,
    dias: DiasDaFatura,
  ): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid || !accountId) return;
    this.salvandoDias.set(true);
    try {
      await this.catalog.salvarDiasDaFatura(uid, accountId, dias);
      this.diasDosCartoes.update((m) => new Map(m).set(accountId, dias));
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Não foi possível salvar as datas.',
      );
    } finally {
      this.salvandoDias.set(false);
    }
  }
  protected readonly comparacao = computed(() =>
    comparacaoNoDia(
      this.historico(),
      this.month(),
      this.diaAtual(),
      3,
      this.cartoes(),
    ),
  );
  protected readonly variacaoGasto = computed(() =>
    variacao(
      this.comparacao().gastos,
      previousMonths(this.month(), 1)[0],
      false,
      this.nomeAnterior(),
    ),
  );
  protected readonly variacaoReceita = computed(() =>
    variacao(
      this.comparacao().receitas,
      previousMonths(this.month(), 1)[0],
      true,
      this.nomeAnterior(),
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
    const anterior = previousMonths(this.month(), 1)[0];
    const doAnterior = this.historico().filter(
      (t) => monthOf(t.date) === anterior,
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
  protected readonly contas = computed(() =>
    contasDoMes(this.historico(), this.month()),
  );
  /** Metas mais apertadas; contas do mês só entram se forem passar da meta. */
  protected readonly apertadas = computed(() => {
    const contas = this.contas();
    return tightestGoals(
      this.linhasMetas().filter((m) => {
        const c = contas.get(m.categoryId);
        return !c || m.spentCents + c.faltaCents > m.limitCents;
      }),
      4,
    );
  });
  protected readonly limiteTotal = computed(() => {
    const soma = this.metas().reduce((s, b) => s + b.limitCents, 0);
    return soma > 0 ? soma : null;
  });
  /** Gasto e receita previstos para o fim do mês (ver `previsaoDoMes`). */
  private readonly previsao = computed(() => {
    const anteriores = previousMonths(this.month(), 3)
      .map((m) =>
        monthTotals(
          this.historico().filter((t) => monthOf(t.date) === m),
          this.cartoes(),
        ),
      )
      .filter((t) => t.spent > 0 || t.income > 0);
    return previsaoDoMes({
      gastoCents: this.totais().spent,
      receitaCents: this.totais().income,
      pace: this.pace(),
      gastosAnteriores: anteriores.map((t) => t.spent),
      receitasAnteriores: anteriores.map((t) => t.income),
    });
  });
  protected readonly gastoProjetado = computed(
    () => this.previsao().gastoCents,
  );
  protected readonly sobraPrevista = computed(
    () => this.previsao().receitaCents - this.gastoProjetado(),
  );
  protected readonly serie = computed(() =>
    cumulativeSpend(this.txs(), this.diaAtual(), this.cartoes()),
  );
  protected readonly statusMeta = computed(() => {
    const limite = this.limiteTotal();
    if (!limite) return null;
    return {
      pct: Math.round((this.totais().spent / limite) * 100),
      // Mesma folga das metas: uma compra no começo do mês não põe tudo "acima do ritmo".
      noRitmo: this.totais().spent <= limite * Math.min(1, this.pace() + 0.15),
    };
  });
  protected readonly resumoRitmo = computed(() => {
    const limite = this.limiteTotal();
    if (!limite)
      return 'Defina metas no Orçamento para ver o ritmo ideal de gasto.';
    const ideal = Math.round(limite * this.pace());
    const dif = this.totais().spent - ideal;
    if (dif > 0 && this.totais().spent <= limite * (this.pace() + 0.15))
      return `Você gastou ${formatBRL(this.totais().spent)} até o dia ${this.diaAtual()}, perto do ritmo ideal.`;
    return dif <= 0
      ? `Você está ${formatBRL(-dif)} abaixo do ritmo ideal para o dia ${this.diaAtual()}.`
      : `Você está ${formatBRL(dif)} acima do ritmo ideal para o dia ${this.diaAtual()}.`;
  });
  protected readonly nomeTx = nomeDeExibicao;
  protected readonly rotuloTransferencia = rotuloTransferencia;
  /** As mais recentes de todo o histórico: no dia 1, sem nada no mês, mostra as do anterior. */
  protected readonly recentes = computed(() =>
    [...this.historico()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
  );
  protected readonly alertas = computed(() =>
    montarAlertas({
      txs: this.historico(),
      month: this.month(),
      today: hojeIso(this.hoje),
      budgets: this.metas(),
      spentByCategory: this.totais().spentByCategory,
      daysLeft: this.diasRestantes(),
      assinaturasId: this.cat('assinaturas')?.id ?? null,
      nomeCategoria: (id) => this.nomeCategoria(id),
      moeda: formatBRL,
      dispensados: this.dispensados(),
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
      await this.periodo.garantir();
      const hoje = hojeIso(this.hoje);
      const chave = this.periodo.atual();
      this.month.set(chave);
      this.diaAtual.set(diaNoPeriodo(hoje));
      this.diasNoMes.set(diasNoPeriodo(chave));
      this.pace.set(this.periodo.ritmo(chave));
      this.diasRestantes.set(this.periodo.diasRestantes(chave));
      const [txs, budgets, cats, contas, saldos, dispensados] =
        await Promise.all([
          // Três períodos antes do atual: começam no máximo um mês antes da chave deles.
          this.txRepo.listRange(
            uid,
            previousMonths(chave, 4).at(-1) as string,
            mesAtual(this.hoje),
          ),
          this.budgetRepo.list(uid),
          this.catalog.categories(uid),
          this.catalog.accounts(uid),
          // Só alimenta o KPI de saldo: se falhar, o resto da tela segue normal.
          this.balancesRepo.list(uid).catch(() => []),
          this.insightsRepo.dispensados(uid, this.month()).catch(() => []),
        ]);
      this.dispensados.set(new Set(dispensados));
      this.saldo.set(saldoAtual(saldos));
      this.saldos.set(saldos);
      this.fatura.set(
        saldos
          .filter((b) => b.kind === 'cartao')
          .reduce((soma, b) => soma + Math.max(0, b.balanceCents), 0),
      );
      this.cartoes.set(
        new Set(contas.filter((c) => c.type === 'cartao').map((c) => c.id)),
      );
      this.diasDosCartoes.set(
        new Map(
          contas
            .filter((c) => c.type === 'cartao' && c.fatura)
            .map((c) => [c.id, c.fatura as DiasDaFatura]),
        ),
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
