import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuthService,
  BudgetsRepository,
  CatalogRepository,
  TransactionsRepository,
  type BudgetDoc,
  type CategoryDoc,
} from '@jano/data-access';
import {
  budgetRows,
  calendario,
  contasDoMes,
  mesesDoPeriodo,
  monthOf,
  previousMonths,
  estadoDaMeta,
  type ContaDoMes,
  limitesComSobra,
  formatBRL,
  monthTotals,
} from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import {
  JanoBanner,
  JanoButton,
  JanoGoalBar,
  JanoMonthNav,
  JanoSkeletonGoals,
  JanoSkeletonGroup,
  JanoSkeletonKpi,
} from '@jano/ui';
import { mesAnterior, mesSeguinte, rotuloMes } from '../transacoes/agrupar';
import { PeriodoService } from '../periodo/periodo.service';

@Component({
  selector: 'jano-orcamento',
  imports: [
    JanoButton,
    JanoBanner,
    JanoGoalBar,
    JanoMonthNav,
    JanoSkeletonGoals,
    JanoSkeletonGroup,
    JanoSkeletonKpi,
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
    .mes {
      margin: 16px 0;
    }
    @media (max-width: 599px) {
      .mes {
        max-width: none;
      }
    }
    .resumo {
      margin-bottom: 20px;
    }
    .resumo .atencao {
      font: 500 14px/20px var(--font-sans);
      color: var(--on-brand);
    }
    .metas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
    }
    .meta {
      all: unset;
      box-sizing: border-box;
      display: block;
      cursor: pointer;
      border-radius: var(--radius-lg);
    }
    .meta:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .meta .sobrou {
      display: block;
      margin: -4px 4px 0;
      padding: 0 16px 12px;
    }
    .dica {
      margin: 12px 0 0;
    }
    .rodape {
      margin-top: 20px;
      display: flex;
      justify-content: center;
    }
    .escurece {
      border: 0;
      padding: 0;
      cursor: default;
      position: fixed;
      inset: 0;
      background: var(--overlay);
      z-index: 55;
    }
    .folha {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 60;
      max-height: 85dvh;
      overflow: auto;
      overscroll-behavior: contain;
      padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    @media (min-width: 720px) {
      .folha {
        left: 50%;
        right: auto;
        bottom: auto;
        top: 50%;
        width: 440px;
        transform: translate(-50%, -50%);
        border-radius: var(--radius-lg);
      }
      .folha .j-sheet__handle {
        display: none;
      }
    }
    .folha h2 {
      margin: 0;
    }
    .folha .contexto {
      margin: -8px 0 0;
    }
    .sobra {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-height: 44px;
      cursor: pointer;
    }
    .sobra input {
      accent-color: var(--primary);
      width: 18px;
      height: 18px;
      margin-top: 3px;
    }
    .botoes {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    select {
      height: 44px;
      width: 100%;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: 400 16px/24px var(--font-sans);
      padding: 0 8px;
    }
  `,
  template: `
    <h1>Orçamento</h1>
    <jano-month-nav
      class="mes"
      [rotulo]="rotulo()"
      (anterior)="mudarMes(-1)"
      (proximo)="mudarMes(1)"
    />

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando metas">
        <jano-skeleton-kpi />
        <div style="margin-top: 24px">
          <jano-skeleton-goals [count]="4" />
        </div>
      </jano-skeleton-group>
    } @else {
      @if (linhas().length) {
        <section class="j-hero resumo" aria-label="Resumo das metas">
          <div class="j-hero__label">{{ resumo().rotulo }}</div>
          <div class="j-hero__valor">{{ money(resumo().cabeCents) }}</div>
          @if (pace() !== undefined) {
            <div
              class="j-hero__mes"
              role="img"
              [attr.aria-label]="ritmo() + '% ' + doQue() + ' passou'"
            >
              <span [style.width.%]="ritmo()"></span>
            </div>
          }
          <div class="j-hero__linha">
            <span
              >Gasto {{ money(resumo().gastoCents) }} de
              {{ money(limiteTotal()) }}</span
            >
            @if (pace() !== undefined) {
              <span>{{ ritmo() }}% {{ doQue() }}</span>
            }
          </div>
          @if (resumo().atencao.length) {
            <div class="atencao">
              Pedem atenção: {{ juntar(resumo().atencao) }}.
            </div>
          }
        </section>

        <div class="metas">
          @for (l of linhas(); track l.categoryId) {
            <button
              type="button"
              class="meta"
              [attr.aria-label]="'Editar meta de ' + nome(l.categoryId)"
              (click)="editar(l.categoryId)"
            >
              <jano-goal-bar
                [name]="nome(l.categoryId)"
                [spentCents]="l.spentCents"
                [limitCents]="l.limitCents"
                [pace]="pace()"
                [daysLeft]="daysLeft()"
                [conta]="contas().get(l.categoryId)"
                [ritmoNoTexto]="false"
              />
            </button>
          }
        </div>
        <p class="j-cap dica">Toque numa meta para mudar o limite.</p>
      } @else {
        <div class="j-empty">
          <div class="j-empty__title">Nenhuma meta ainda</div>
          <div class="j-empty__text">
            Defina quanto quer gastar por mês em cada categoria. O Jano mostra o
            ritmo e avisa antes de passar.
          </div>
        </div>
      }

      @if (semMeta().length) {
        <div class="rodape">
          <button
            janoButton
            [variant]="linhas().length ? 'secondary' : 'primary'"
            type="button"
            (click)="editar(null)"
          >
            Nova meta
          </button>
        </div>
      }
    }

    @if (editando(); as ed) {
      <button
        type="button"
        class="escurece"
        aria-label="Fechar"
        (click)="fechar()"
      ></button>
      <section
        class="j-sheet folha"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="
          ed.categoryId ? 'Meta de ' + nome(ed.categoryId) : 'Nova meta'
        "
        (keydown.escape)="fechar()"
      >
        <div class="j-sheet__handle" aria-hidden="true"></div>
        <h2 class="j-sheet__title">
          {{ ed.categoryId ? nome(ed.categoryId) : 'Nova meta' }}
        </h2>
        @if (ed.categoryId; as id) {
          @if (contextoMeta(id); as c) {
            <p class="j-sub contexto">{{ c }}</p>
          }
        } @else {
          <label class="j-field">
            <span class="j-field__label">Categoria</span>
            <select
              id="nova-cat"
              [value]="novaCategoria()"
              (change)="novaCategoria.set($any($event.target).value)"
            >
              @for (c of semMeta(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </label>
        }
        <label class="j-field">
          <span class="j-field__label">Limite mensal</span>
          <span class="j-input">
            <span class="j-input__prefix">R$</span>
            <input
              #lim
              [id]="'lim-' + (ed.categoryId ?? 'nova')"
              [value]="
                ed.categoryId
                  ? paraTexto(meta(ed.categoryId)?.limitCents ?? 0)
                  : ''
              "
              inputmode="decimal"
              placeholder="0,00"
              (keydown.enter)="
                salvar(
                  ed.categoryId ?? novaCategoria(),
                  lim.value,
                  sobra.checked
                )
              "
            />
          </span>
        </label>
        <label class="sobra">
          <input
            #sobra
            id="sobra-meta"
            type="checkbox"
            [checked]="ed.categoryId ? meta(ed.categoryId)?.rollover : false"
          />
          <span>
            <span class="j-field__label"
              >Levar a sobra para o mês seguinte</span
            >
            <span class="j-field__hint" style="display: block"
              >O que não for gasto soma ao limite de {{ proximoMes() }}.</span
            >
          </span>
        </label>
        <div class="botoes">
          @if (ed.categoryId) {
            <button
              janoButton
              variant="ghost"
              type="button"
              [carregando]="acao() === 'remover'"
              textoCarregando="Removendo…"
              (click)="remover(ed.categoryId)"
            >
              Remover meta
            </button>
          } @else {
            <span></span>
          }
          <button
            janoButton
            variant="primary"
            type="button"
            [carregando]="acao() === 'salvar'"
            textoCarregando="Salvando…"
            (click)="
              salvar(ed.categoryId ?? novaCategoria(), lim.value, sobra.checked)
            "
          >
            Salvar
          </button>
        </div>
      </section>
    }
  `,
})
export class Orcamento {
  private readonly auth = inject(AuthService);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);
  protected readonly periodo = inject(PeriodoService);

  protected readonly money = formatBRL;
  protected readonly month = signal(new Date().toISOString().slice(0, 7));
  protected readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly budgets = signal<BudgetDoc[]>([]);
  private cartoes: ReadonlySet<string> = new Set();
  protected readonly totais = signal(monthTotals([]));
  /** Contas do mês (aluguel, escola): frase de pago/falta pagar no lugar do ritmo. */
  protected readonly contas = signal(new Map<string, ContaDoMes>());
  /** Gasto por categoria no mês anterior; `null` quando ele não tem dados. */
  private readonly gastoAnterior = signal<Record<string, number> | null>(null);
  /** Metas do mês com a sobra do anterior somada ao limite (rollover). */
  private readonly efetivas = computed(() =>
    limitesComSobra(this.budgets(), this.gastoAnterior()),
  );
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly rotulo = computed(() =>
    this.periodo.peloSalario()
      ? this.periodo.rotulo(this.month())
      : rotuloMes(this.month()),
  );
  /** Meta em edição na folha; `categoryId: null` = nova meta. */
  protected readonly editando = signal<{ categoryId: string | null } | null>(
    null,
  );
  protected readonly novaCategoria = signal('');
  /** Ação da folha em andamento, para o botão dela mostrar o retorno. */
  protected readonly acao = signal<'salvar' | 'remover' | null>(null);
  /** Do que pede mais atenção ao que pede menos: estado da meta primeiro, depois a proporção. */
  protected readonly linhas = computed(() => {
    const contas = this.contas();
    const peso = { over: 0, warning: 1, ok: 2 };
    const chave = (b: {
      categoryId: string;
      spentCents: number;
      limitCents: number;
    }) => {
      const conta = contas.get(b.categoryId);
      const { status } = estadoDaMeta({ ...b, pace: this.pace(), conta });
      const proporcao =
        (b.spentCents + (conta?.faltaCents ?? 0)) / (b.limitCents || 1);
      return { peso: peso[status], proporcao };
    };
    return budgetRows(this.efetivas(), this.totais().spentByCategory)
      .map((b) => ({ b, k: chave(b) }))
      .sort((x, y) => x.k.peso - y.k.peso || y.k.proporcao - x.k.proporcao)
      .map(({ b }) => b);
  });
  protected readonly doQue = computed(() =>
    this.periodo.peloSalario() ? 'do período' : 'do mês',
  );
  protected readonly ritmo = computed(() =>
    Math.round((this.pace() ?? 1) * 100),
  );
  /** O que ainda cabe nas metas (descontando as contas do mês por pagar) e quais pedem atenção. */
  protected readonly resumo = computed(() => {
    const contas = this.contas();
    let cabeCents = 0;
    let gastoCents = 0;
    const atencao: string[] = [];
    for (const l of this.linhas()) {
      const conta = contas.get(l.categoryId);
      gastoCents += l.spentCents;
      cabeCents += Math.max(
        0,
        l.limitCents - l.spentCents - (conta?.faltaCents ?? 0),
      );
      const { status } = estadoDaMeta({
        spentCents: l.spentCents,
        limitCents: l.limitCents,
        pace: this.pace(),
        conta,
      });
      if (status !== 'ok') atencao.push(this.nome(l.categoryId));
    }
    const fim = calendario().fim(this.month());
    return {
      rotulo:
        this.month() === this.mesAtual()
          ? `Ainda cabe nas metas até ${fim.slice(8, 10)}/${fim.slice(5, 7)}`
          : 'Sobrou nas metas',
      cabeCents,
      gastoCents,
      atencao,
    };
  });
  protected readonly limiteTotal = computed(() =>
    this.efetivas().reduce((s, b) => s + b.limitCents, 0),
  );
  /** "novembro" ou, pelo salário, "o próximo período". */
  protected readonly proximoMes = computed(() =>
    this.periodo.peloSalario()
      ? 'o próximo período'
      : rotuloMes(mesSeguinte(this.month())).split(' ')[0].toLowerCase(),
  );
  protected readonly mesPassado = computed(() =>
    this.periodo.peloSalario()
      ? 'o período anterior'
      : rotuloMes(mesAnterior(this.month())).split(' ')[0].toLowerCase(),
  );
  protected readonly semMeta = computed(() => {
    const usadas = new Set(this.budgets().map((b) => b.categoryId));
    return this.categorias().filter(
      (c) => c.type === 'despesa' && !usadas.has(c.id),
    );
  });

  /** Período de hoje: só nele há ritmo e dias restantes. */
  private readonly mesAtual = this.periodo.atual;
  protected readonly pace = computed(() =>
    this.month() === this.mesAtual()
      ? this.periodo.ritmo(this.month())
      : undefined,
  );
  protected readonly daysLeft = computed(() =>
    this.month() === this.mesAtual()
      ? this.periodo.diasRestantes(this.month())
      : undefined,
  );

  constructor() {
    void this.iniciar();
  }

  private get uid(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    return u.uid;
  }

  private async iniciar(): Promise<void> {
    try {
      const [cats, budgets, contas] = await Promise.all([
        this.catalog.categories(this.uid),
        this.budgetRepo.list(this.uid),
        this.catalog.accounts(this.uid),
      ]);
      this.cartoes = new Set(
        contas.filter((c) => c.type === 'cartao').map((c) => c.id),
      );
      this.categorias.set(cats);
      this.budgets.set(budgets);
      await this.periodo.garantir();
      this.month.set(this.periodo.atual());
      await this.carregarMes();
    } catch (e) {
      this.falha(e);
      this.carregando.set(false);
    }
  }

  private async carregarMes(): Promise<void> {
    this.carregando.set(true);
    try {
      // O período e os dois anteriores; um período pode começar no mês de antes da chave.
      const chave = this.month();
      const anterior = mesAnterior(chave);
      const todas = await this.txRepo.listRange(
        this.uid,
        previousMonths(chave, 3).at(-1) as string,
        mesesDoPeriodo(chave).at(-1) as string,
      );
      const doPeriodo = (k: string) =>
        todas.filter((t) => monthOf(t.date) === k);
      const doMes = doPeriodo(chave);
      const doAnterior = doPeriodo(anterior);
      const antesDele = doPeriodo(mesAnterior(anterior));
      this.totais.set(monthTotals(doMes, this.cartoes));
      this.contas.set(
        contasDoMes([...doMes, ...doAnterior, ...antesDele], this.month()),
      );
      this.gastoAnterior.set(
        doAnterior.length
          ? monthTotals(doAnterior, this.cartoes).spentByCategory
          : null,
      );
    } catch (e) {
      this.falha(e);
    } finally {
      this.carregando.set(false);
    }
  }

  protected mudarMes(delta: 1 | -1): void {
    this.month.update((m) => (delta === 1 ? mesSeguinte(m) : mesAnterior(m)));
    void this.carregarMes();
  }

  protected editar(categoryId: string | null): void {
    this.erro.set('');
    if (categoryId === null)
      this.novaCategoria.set(this.semMeta()[0]?.id ?? '');
    this.editando.set({ categoryId });
  }

  protected fechar(): void {
    this.editando.set(null);
  }

  /** "Mercado e Assinaturas", "A, B e C". */
  protected juntar(nomes: string[]): string {
    return nomes.length < 2
      ? (nomes[0] ?? '')
      : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  }

  /** Na folha: quanto já foi neste mês e a sobra que entrou no limite. */
  protected contextoMeta(id: string): string {
    const l = this.linhas().find((x) => x.categoryId === id);
    if (!l) return '';
    const partes = [
      `${formatBRL(l.spentCents)} gastos ${this.periodo.peloSalario() ? 'neste período' : 'em ' + rotuloMes(this.month()).split(' ')[0].toLowerCase()}.`,
    ];
    const sobra = this.sobraDe(id);
    if (sobra)
      partes.push(
        `O limite inclui ${formatBRL(sobra)} que sobraram em ${this.mesPassado()}.`,
      );
    return partes.join(' ');
  }

  /** A meta como gravada (limite sem a sobra). */
  protected meta(id: string): BudgetDoc | undefined {
    return this.budgets().find((b) => b.categoryId === id);
  }

  protected sobraDe(id: string): number {
    return this.efetivas().find((b) => b.categoryId === id)?.sobraCents ?? 0;
  }

  protected nome(id: string): string {
    return this.categorias().find((c) => c.id === id)?.name ?? id;
  }

  protected paraTexto(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  protected async salvar(
    categoryId: string,
    texto: string,
    rollover: boolean,
  ): Promise<void> {
    this.erro.set('');
    if (!categoryId) return;
    const cents = parseAmountToCents(texto);
    if (cents === null || cents <= 0) {
      this.erro.set('Informe um limite maior que zero, por exemplo 900,00.');
      return;
    }
    this.acao.set('salvar');
    try {
      await this.budgetRepo.save(this.uid, categoryId, cents, rollover);
      this.budgets.update((list) => [
        ...list.filter((b) => b.categoryId !== categoryId),
        { categoryId, limitCents: cents, rollover },
      ]);
      this.fechar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.acao.set(null);
    }
  }

  protected async remover(categoryId: string): Promise<void> {
    this.acao.set('remover');
    try {
      await this.budgetRepo.remove(this.uid, categoryId);
      this.budgets.update((list) =>
        list.filter((b) => b.categoryId !== categoryId),
      );
      this.fechar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.acao.set(null);
    }
  }

  private falha(e: unknown): void {
    this.erro.set(
      e instanceof Error ? e.message : 'Tente de novo em instantes.',
    );
  }
}
