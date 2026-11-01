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
  InsightsRepository,
  TransactionsRepository,
  type BudgetDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import {
  categoriesAboveNormal,
  daysLeftInMonth,
  formatBRL,
  previousMonths,
  goalStreaks,
  monthPace,
} from '@jano/engine';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoSkeletonCard,
  JanoSkeletonGroup,
  JanoSkeletonRows,
} from '@jano/ui';
import { montarAlertas, type Alerta } from '../inicio/alertas';
import { Progresso } from '../shell/progresso';
import { marcarTransferencias } from '../transacoes/transferencias';
import { mesAtual, rotuloMes } from '../transacoes/agrupar';
import {
  compararComAnterior,
  distribuicao,
  fraseMesFechado,
  fraseResumo,
  gastoDoMes,
  maioresEstabelecimentos,
  serieMensal,
  ultimosMeses,
} from './avaliar';

/** Até este dia, Avaliações lê o mês que fechou e não dá nota ao atual. */
const DIAS_COMECO = 5;

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
const GRAF = { w: 360, h: 190, x0: 54, base: 160, topo: 16 };
const RAIO = 40;
const CIRC = 2 * Math.PI * RAIO;

/** Avaliações: a leitura do mês em linguagem simples, com comparativos e insights. */
@Component({
  selector: 'jano-avaliacoes',
  imports: [
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoCategoryBadge,
    JanoSkeletonCard,
    JanoSkeletonGroup,
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
    .resumo {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: center;
      margin: 16px 0 24px;
    }
    .frase {
      margin: 0;
      font: 600 24px/32px var(--font-sans);
      max-width: 640px;
    }
    details {
      font: 400 14px/20px var(--font-sans);
      color: var(--text-2);
    }
    summary {
      cursor: pointer;
      color: var(--primary-text);
      font-weight: 500;
    }
    details ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    .colunas {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    .coluna {
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 0;
    }
    .insights {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .j-insight__text {
      margin: 2px 0 4px;
    }
    .acao {
      font: 500 14px/20px var(--font-sans);
      color: var(--primary-text);
      text-decoration: none;
    }
    .acao:hover {
      text-decoration: underline;
    }
    .acoes {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .dispensar {
      border: 0;
      background: none;
      padding: 0;
      cursor: pointer;
      color: var(--text-2);
    }
    .vazio {
      color: var(--text-2);
      font: 400 14px/20px var(--font-sans);
      margin: 0;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li.est {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    li.est:last-child {
      border-bottom: 0;
    }
    /* A colocação fica num selo sobre o ícone da categoria, sem coluna própria. */
    .icone {
      position: relative;
      display: inline-flex;
    }
    .pos {
      position: absolute;
      top: -4px;
      left: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      box-sizing: border-box;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: var(--text);
      color: var(--surface);
      font: 600 11px/1 var(--font-sans);
      box-shadow: 0 0 0 2px var(--surface);
    }
    .est .nome {
      overflow-wrap: anywhere;
    }
    .est .j-num {
      white-space: nowrap;
    }
    .sub {
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    svg.graf {
      width: 100%;
      height: auto;
      display: block;
    }
    svg text {
      font: 400 11px var(--font-sans);
      fill: var(--text-2);
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin-top: 8px;
      font: 400 13px/20px var(--font-sans);
      color: var(--text-2);
    }
    .legenda i,
    .fatias i {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      margin-right: 6px;
    }
    .rosca {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 20px;
      align-items: center;
    }
    .fatias {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font: 400 14px/20px var(--font-sans);
    }
    .fatias li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    @media (max-width: 899px) {
      .resumo,
      .colunas {
        grid-template-columns: 1fr;
      }
      .frase {
        font-size: 20px;
        line-height: 28px;
      }
      .rosca {
        grid-template-columns: 110px 1fr;
      }
    }
  `,
  template: `
    <h1>Avaliações</h1>
    <div class="j-sub">{{ mes() }}</div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando avaliações">
        <div class="resumo">
          <jano-skeleton-card altura="48px" />
          <jano-skeleton-card altura="48px" />
        </div>
        <div class="colunas">
          <div class="coluna">
            <jano-skeleton-rows [count]="4" />
          </div>
          <div class="coluna">
            <jano-skeleton-card altura="180px" />
            <jano-skeleton-card altura="140px" />
          </div>
        </div>
      </jano-skeleton-group>
    } @else if (!temDados()) {
      <div class="j-card j-empty" style="margin-top: 24px">
        <div class="j-empty__title">Ainda não há o que avaliar</div>
        <div class="j-empty__text">
          Importe o extrato ou a fatura do mês para ver a leitura dos seus
          gastos.
        </div>
        <a janoButton variant="primary" routerLink="/transacoes">Importar</a>
      </div>
    } @else {
      <section class="resumo" aria-label="Resumo do mês">
        <p class="frase">{{ frase() }}</p>
      </section>

      <div class="colunas">
        <div class="coluna">
          <section aria-label="O que mudou">
            <h2>O que mudou</h2>
            <div class="insights">
              @for (a of insights(); track a.titulo) {
                <div class="j-insight">
                  <div
                    class="j-insight__icon"
                    [style.background]="fundo(a)"
                    [style.color]="cor(a)"
                    aria-hidden="true"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      @if (a.tom === 'good') {
                        <path
                          d="M5 12.5L10 17.5L19 7"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      } @else if (a.tom === 'warn') {
                        <path
                          d="M12 3L22 20H2Z M12 10V14"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linejoin="round"
                          stroke-linecap="round"
                        />
                      } @else {
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <path
                          d="M12 11V16"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      }
                    </svg>
                  </div>
                  <div>
                    <div class="j-insight__title">{{ a.titulo }}</div>
                    <p class="j-insight__text">{{ a.texto }}</p>
                    <div class="acoes">
                      @if (a.acao; as ac) {
                        <a
                          class="acao"
                          [routerLink]="ac.rota"
                          [queryParams]="ac.queryParams"
                          >{{ ac.rotulo }}</a
                        >
                      }
                      <button
                        type="button"
                        class="acao dispensar"
                        [attr.aria-label]="'Dispensar: ' + a.titulo"
                        (click)="dispensar(a)"
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <p class="vazio">
                  Nada fora do padrão neste mês. Quando algo mudar, aparece
                  aqui.
                </p>
              }
            </div>
          </section>

          <section class="j-card" aria-label="Maiores estabelecimentos">
            <h2>5 maiores estabelecimentos</h2>
            <ol>
              @for (e of estabelecimentos(); track e.nome; let i = $index) {
                <li class="est">
                  <span class="icone">
                    <jano-category-badge
                      [icon]="cat(e.categoryId)?.icon ?? 'etiqueta'"
                      [colorToken]="cat(e.categoryId)?.color ?? 'cat-1'"
                      [size]="36"
                    />
                    <span class="pos" [attr.aria-label]="i + 1 + 'º'">{{
                      i + 1
                    }}</span>
                  </span>
                  <div class="nome">
                    <div>{{ e.nome }}</div>
                    <div class="sub">
                      {{ nomeCat(e.categoryId) }} · {{ e.compras }}
                      {{ e.compras === 1 ? 'compra' : 'compras' }}
                    </div>
                  </div>
                  <span class="j-num">{{ money(e.cents) }}</span>
                </li>
              }
            </ol>
          </section>
        </div>

        <div class="coluna">
          <section class="j-card" aria-label="Mês a mês por categoria">
            <h2>Mês a mês por categoria</h2>
            <svg
              class="graf"
              [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h"
              role="img"
              [attr.aria-label]="resumoBarras()"
            >
              @for (l of linhasGrade(); track l.y) {
                <line
                  [attr.x1]="g.x0"
                  [attr.x2]="g.w - 8"
                  [attr.y1]="l.y"
                  [attr.y2]="l.y"
                  style="stroke: var(--border)"
                />
                <text [attr.x]="g.x0 - 6" [attr.y]="l.y + 4" text-anchor="end">
                  {{ l.rotulo }}
                </text>
              }
              @for (b of barras(); track $index) {
                <rect
                  [attr.x]="b.x"
                  [attr.y]="b.y"
                  [attr.width]="b.w"
                  [attr.height]="b.h"
                  rx="2"
                  [style.fill]="b.cor"
                />
              }
              @for (m of rotulosMeses(); track m.x) {
                <text
                  [attr.x]="m.x"
                  [attr.y]="g.base + 18"
                  text-anchor="middle"
                >
                  {{ m.t }}
                </text>
              }
            </svg>
            <div class="legenda">
              @for (s of series(); track s.categoryId) {
                <span
                  ><i
                    [style.background]="'var(--' + corDe(s.categoryId) + ')'"
                  ></i
                  >{{ nomeCat(s.categoryId) }}</span
                >
              }
            </div>
          </section>

          <section class="j-card" aria-label="Para onde foi o dinheiro">
            <h2>Para onde foi o dinheiro</h2>
            <div class="rosca">
              <svg
                viewBox="0 0 100 100"
                role="img"
                [attr.aria-label]="resumoRosca()"
              >
                <g transform="rotate(-90 50 50)">
                  @for (f of fatias(); track $index) {
                    <circle
                      cx="50"
                      cy="50"
                      [attr.r]="raio"
                      fill="none"
                      stroke-width="16"
                      [attr.stroke-dasharray]="f.da"
                      [attr.stroke-dashoffset]="f.off"
                      [style.stroke]="f.cor"
                    />
                  }
                </g>
              </svg>
              <ul class="fatias">
                @for (f of fatias(); track $index) {
                  <li>
                    <span><i [style.background]="f.cor"></i>{{ f.nome }}</span>
                    <span class="j-num">{{ f.pct }}%</span>
                  </li>
                }
              </ul>
            </div>
          </section>
        </div>
      </div>
    }
  `,
})
export class Avaliacoes {
  private readonly auth = inject(AuthService);
  private readonly progresso = inject(Progresso);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly insightsRepo = inject(InsightsRepository);

  protected readonly money = formatBRL;
  /** Insights dispensados neste mês. */
  private readonly dispensados = signal<ReadonlySet<string>>(new Set());
  protected readonly g = GRAF;
  protected readonly raio = RAIO;

  private readonly hoje = new Date();
  private readonly month = mesAtual(this.hoje);
  private readonly dia = this.hoje.getDate();
  private readonly pace = monthPace(
    this.hoje.getFullYear(),
    this.hoje.getMonth() + 1,
    this.dia,
  );
  /** Nos primeiros dias o mês ainda não diz nada: a leitura é a do mês que fechou. */
  private readonly comecoDoMes = this.dia <= DIAS_COMECO;
  /**
   * Mês que a tela lê: o atual; nos primeiros dias, sem lançamentos ainda, o que acabou de
   * fechar (dia 1 sem nada importado não é "sem dados").
   */
  private readonly mesAnalise = computed(() =>
    !this.comecoDoMes ||
    this.historico().some((t) => t.date.startsWith(this.month))
      ? this.month
      : previousMonths(this.month, 1)[0],
  );
  private readonly fechado = computed(() => this.mesAnalise() !== this.month);
  protected readonly mes = computed(
    () =>
      rotuloMes(this.mesAnalise()) + (this.fechado() ? ' · mês fechado' : ''),
  );
  private readonly meses = ultimosMeses(this.month, 6);

  private readonly historico = signal<TransactionDoc[]>([]);
  private readonly budgets = signal<BudgetDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  private readonly cartoes = signal<ReadonlySet<string>>(new Set());
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly temDados = computed(() => this.historico().length > 0);
  private readonly gastoMes = computed(() =>
    gastoDoMes(this.historico(), this.mesAnalise(), this.cartoes()),
  );

  private readonly acima = computed(() =>
    categoriesAboveNormal(this.historico(), this.mesAnalise()),
  );
  protected readonly frase = computed(() => {
    if (this.comecoDoMes) {
      const fechado = previousMonths(this.month, 1)[0];
      const topo = categoriesAboveNormal(this.historico(), fechado)[0];
      return fraseMesFechado(
        compararComAnterior(this.historico(), fechado, 31, this.cartoes()),
        fechado,
        topo ? { nome: this.nomeCat(topo.categoryId), pct: topo.pct } : null,
        formatBRL,
      );
    }
    const topo = this.acima()[0];
    return fraseResumo(
      compararComAnterior(
        this.historico(),
        this.month,
        this.dia,
        this.cartoes(),
      ),
      this.month,
      topo ? { nome: this.nomeCat(topo.categoryId), pct: topo.pct } : null,
    );
  });

  protected readonly insights = computed<Alerta[]>(() => {
    const mes = this.mesAnalise();
    const [ano, m] = mes.split('-').map(Number);
    const ultimo = new Date(ano, m, 0).getDate();
    const dia = this.fechado() ? ultimo : this.dia;
    const base = montarAlertas({
      txs: this.historico(),
      month: mes,
      today: `${mes}-${String(dia).padStart(2, '0')}`,
      budgets: this.budgets(),
      spentByCategory: this.gastoMes().porCategoria,
      daysLeft: daysLeftInMonth(ano, m, dia),
      assinaturasId:
        this.categorias().find((c) => c.id === 'assinaturas')?.id ?? null,
      nomeCategoria: (id) => this.nomeCat(id),
      moeda: formatBRL,
      max: 6,
      dispensados: this.dispensados(),
    });
    const sequencias: Alerta[] = goalStreaks(
      this.historico(),
      this.budgets(),
      mes,
    )
      .map((s): Alerta => ({
        id: `sequencia:${s.categoryId}`,
        tom: 'good',
        titulo: `${this.nomeCat(s.categoryId)} dentro da meta há ${s.months} meses`,
        texto: 'Sem ultrapassar o limite nos meses fechados.',
      }))
      .filter((a) => !this.dispensados().has(a.id))
      .slice(0, 2);
    return [...base, ...sequencias].slice(0, 6);
  });

  protected readonly estabelecimentos = computed(() =>
    maioresEstabelecimentos(this.historico(), this.mesAnalise()),
  );

  // Barras agrupadas: 6 meses × até 3 categorias.
  protected readonly series = computed(() =>
    serieMensal(this.historico(), this.meses, this.cartoes()),
  );
  private readonly maxBarra = computed(() => {
    const max = Math.max(1, ...this.series().flatMap((s) => s.valores));
    const passo = [10000, 25000, 50000, 100000, 250000, 500000].find(
      (p) => p * 4 >= max,
    );
    return Math.ceil(max / (passo ?? 500000)) * (passo ?? 500000);
  });
  protected readonly linhasGrade = computed(() => {
    const max = this.maxBarra();
    return [0, 0.5, 1].map((f) => ({
      y: GRAF.base - f * (GRAF.base - GRAF.topo),
      rotulo: this.rotuloEixo(max * f),
    }));
  });
  protected readonly barras = computed(() => {
    const n = this.series().length || 1;
    const larg = (GRAF.w - GRAF.x0 - 8) / this.meses.length;
    const bw = Math.min(14, (larg - 8) / n);
    return this.series().flatMap((s, si) =>
      s.valores.map((v, mi) => {
        const h = (v / this.maxBarra()) * (GRAF.base - GRAF.topo);
        return {
          x: GRAF.x0 + mi * larg + (larg - n * bw) / 2 + si * bw,
          y: GRAF.base - h,
          w: bw - 1,
          h,
          cor: `var(--${this.corDe(s.categoryId)})`,
        };
      }),
    );
  });
  protected readonly rotulosMeses = computed(() => {
    const larg = (GRAF.w - GRAF.x0 - 8) / this.meses.length;
    return this.meses.map((m, i) => ({
      t: MESES_ABREV[Number(m.slice(5, 7)) - 1],
      x: GRAF.x0 + i * larg + larg / 2,
    }));
  });
  protected readonly resumoBarras = computed(
    () =>
      'Gasto por mês nas maiores categorias: ' +
      this.series()
        .map(
          (s) =>
            `${this.nomeCat(s.categoryId)}, ${s.valores.map((v) => formatBRL(v)).join(', ')}`,
        )
        .join('; '),
  );

  // Rosca de distribuição.
  protected readonly fatias = computed(() => {
    const f = distribuicao(this.gastoMes().porCategoria);
    let acc = 0;
    return f.map((x) => {
      const len = (x.pct / 100) * CIRC;
      const fatia = {
        nome: x.categoryId ? this.nomeCat(x.categoryId) : 'Outras',
        pct: x.pct,
        cor: x.categoryId
          ? `var(--${this.corDe(x.categoryId)})`
          : 'var(--text-2)',
        da: `${len.toFixed(2)} ${CIRC.toFixed(2)}`,
        off: (-acc).toFixed(2),
      };
      acc += len;
      return fatia;
    });
  });
  protected readonly resumoRosca = computed(
    () =>
      'Distribuição do gasto: ' +
      this.fatias()
        .map((f) => `${f.nome} ${f.pct}%`)
        .join(', '),
  );

  constructor() {
    void this.carregar();
  }

  protected cat(id: string | null): CategoryDoc | undefined {
    return id ? this.categorias().find((c) => c.id === id) : undefined;
  }

  protected nomeCat(id: string | null): string {
    return id ? (this.cat(id)?.name ?? id) : 'Sem categoria';
  }

  protected corDe(id: string | null): string {
    return this.cat(id)?.color ?? 'cat-1';
  }

  protected fundo(a: Alerta): string {
    return a.tom === 'warn'
      ? 'var(--warning-soft)'
      : a.tom === 'good'
        ? 'var(--positive-soft)'
        : 'var(--info-soft)';
  }

  protected cor(a: Alerta): string {
    return a.tom === 'warn'
      ? 'var(--warning-text)'
      : a.tom === 'good'
        ? 'var(--positive)'
        : 'var(--info)';
  }

  private rotuloEixo(cents: number): string {
    const reais = cents / 100;
    return reais >= 1000
      ? `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
      : `R$ ${Math.round(reais)}`;
  }

  private carregar(): Promise<void> {
    return this.progresso.acompanhar(this.carregarDados());
  }

  /** Some na hora; grava para não voltar neste mês. */
  protected async dispensar(a: Alerta): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    const antes = this.dispensados();
    this.dispensados.set(new Set([...antes, a.id]));
    try {
      await this.insightsRepo.dispensar(uid, this.month, a.id);
    } catch (e) {
      this.dispensados.set(antes);
      this.erro.set(
        e instanceof Error
          ? e.message
          : 'Não consegui dispensar. Tente de novo.',
      );
    }
  }

  private async carregarDados(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    try {
      const [txs, budgets, cats, contas, dispensados] = await Promise.all([
        this.txRepo.listRange(uid, this.meses[0], this.month),
        this.budgetRepo.list(uid),
        this.catalog.categories(uid),
        this.catalog.accounts(uid),
        // Complemento: se falhar, os insights aparecem todos.
        this.insightsRepo.dispensados(uid, this.month).catch(() => []),
      ]);
      this.dispensados.set(new Set(dispensados));
      this.cartoes.set(
        new Set(contas.filter((c) => c.type === 'cartao').map((c) => c.id)),
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
