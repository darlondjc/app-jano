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
  contasDoMes,
  daysLeftInMonth,
  type ContaDoMes,
  limitesComSobra,
  formatBRL,
  monthPace,
  monthTotals,
} from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import {
  JanoBanner,
  JanoButton,
  JanoGoalBar,
  JanoKpiCard,
  JanoMonthNav,
  JanoSkeletonGoals,
  JanoSkeletonGroup,
  JanoSkeletonKpi,
} from '@jano/ui';
import { mesAnterior, mesSeguinte, rotuloMes } from '../transacoes/agrupar';

@Component({
  selector: 'jano-orcamento',
  imports: [
    JanoButton,
    JanoBanner,
    JanoGoalBar,
    JanoKpiCard,
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
    .metas {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .linha {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .edicao {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }
    .edicao .j-input {
      width: 140px;
    }
    .sobra {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .sobra label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-height: 44px;
      cursor: pointer;
    }
    .sobra input[type='checkbox'] {
      accent-color: var(--primary);
      width: 18px;
      height: 18px;
      margin-top: 3px;
    }
    .nova {
      margin-top: 24px;
      display: flex;
      gap: 8px;
      align-items: end;
      flex-wrap: wrap;
    }
    select {
      height: 44px;
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
      <jano-kpi-card
        label="Gasto do mês"
        [valueCents]="totais().spent"
        tone="out"
      >
        <div class="j-sub">
          de {{ money(limiteTotal()) }} em metas · receitas
          {{ money(totais().income) }}
        </div>
      </jano-kpi-card>

      @if (!linhas().length && !carregando()) {
        <p class="j-sub" style="margin-top:24px">
          Você ainda não criou metas. Escolha uma categoria abaixo e defina um
          limite mensal.
        </p>
      }

      <div class="metas">
        @for (l of linhas(); track l.categoryId) {
          <div class="linha">
            <jano-goal-bar
              [name]="nome(l.categoryId)"
              [spentCents]="l.spentCents"
              [limitCents]="l.limitCents"
              [pace]="pace()"
              [daysLeft]="daysLeft()"
              [conta]="contas().get(l.categoryId)"
            />
            <div class="sobra">
              <label>
                <input
                  type="checkbox"
                  [checked]="meta(l.categoryId)?.rollover"
                  (change)="
                    mudarSobra(l.categoryId, $any($event.target).checked)
                  "
                />
                <span>
                  <span class="j-field__label"
                    >Levar a sobra para o mês seguinte</span
                  >
                  <span class="j-field__hint" style="display: block"
                    >O que não for gasto soma ao limite de
                    {{ proximoMes() }}.</span
                  >
                </span>
              </label>
              @if (sobraDe(l.categoryId); as sobra) {
                <span class="j-cap"
                  >Inclui {{ money(sobra) }} que sobraram em
                  {{ mesPassado() }}.</span
                >
              }
            </div>
            <div class="edicao">
              <label class="j-sr" [for]="'lim-' + l.categoryId"
                >Limite de {{ nome(l.categoryId) }}</label
              >
              <span class="j-input">
                <span class="j-input__prefix">R$</span>
                <input
                  [id]="'lim-' + l.categoryId"
                  [value]="paraTexto(meta(l.categoryId)?.limitCents ?? 0)"
                  #campo
                  inputmode="decimal"
                />
              </span>
              <button
                janoButton
                variant="secondary"
                type="button"
                (click)="salvar(l.categoryId, campo.value)"
              >
                Salvar
              </button>
              <button
                janoButton
                variant="ghost"
                type="button"
                (click)="remover(l.categoryId)"
              >
                Remover
              </button>
            </div>
          </div>
        }
      </div>
    }

    @if (!carregando() && semMeta().length) {
      <div class="nova">
        <label class="j-field">
          <span class="j-field__label">Nova meta</span>
          <select #cat aria-label="Categoria da nova meta">
            @for (c of semMeta(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
        <label class="j-field">
          <span class="j-field__label">Limite mensal</span>
          <span class="j-input" style="width:140px">
            <span class="j-input__prefix">R$</span>
            <input #lim inputmode="decimal" placeholder="0,00" />
          </span>
        </label>
        <button
          janoButton
          variant="primary"
          type="button"
          (click)="salvar(cat.value, lim.value)"
        >
          Criar meta
        </button>
      </div>
    }
  `,
})
export class Orcamento {
  private readonly auth = inject(AuthService);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);

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

  protected readonly rotulo = computed(() => rotuloMes(this.month()));
  protected readonly linhas = computed(() =>
    budgetRows(this.efetivas(), this.totais().spentByCategory).sort(
      (a, b) =>
        b.spentCents / (b.limitCents || 1) - a.spentCents / (a.limitCents || 1),
    ),
  );
  protected readonly limiteTotal = computed(() =>
    this.efetivas().reduce((s, b) => s + b.limitCents, 0),
  );
  protected readonly proximoMes = computed(() =>
    rotuloMes(mesSeguinte(this.month())).split(' ')[0].toLowerCase(),
  );
  protected readonly mesPassado = computed(() =>
    rotuloMes(mesAnterior(this.month())).split(' ')[0].toLowerCase(),
  );
  protected readonly semMeta = computed(() => {
    const usadas = new Set(this.budgets().map((b) => b.categoryId));
    return this.categorias().filter(
      (c) => c.type === 'despesa' && !usadas.has(c.id),
    );
  });

  private readonly hoje = new Date();
  private readonly mesAtual = this.hoje.toISOString().slice(0, 7);
  protected readonly pace = computed(() =>
    this.month() === this.mesAtual
      ? monthPace(
          this.hoje.getFullYear(),
          this.hoje.getMonth() + 1,
          this.hoje.getDate(),
        )
      : undefined,
  );
  protected readonly daysLeft = computed(() =>
    this.month() === this.mesAtual
      ? daysLeftInMonth(
          this.hoje.getFullYear(),
          this.hoje.getMonth() + 1,
          this.hoje.getDate(),
        )
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
      await this.carregarMes();
    } catch (e) {
      this.falha(e);
      this.carregando.set(false);
    }
  }

  private async carregarMes(): Promise<void> {
    this.carregando.set(true);
    try {
      const anterior = mesAnterior(this.month());
      const [doMes, doAnterior, antesDele] = await Promise.all([
        this.txRepo.listMonth(this.uid, this.month()),
        this.txRepo.listMonth(this.uid, anterior),
        this.txRepo.listMonth(this.uid, mesAnterior(anterior)),
      ]);
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

  /** A meta como gravada (limite sem a sobra). */
  protected meta(id: string): BudgetDoc | undefined {
    return this.budgets().find((b) => b.categoryId === id);
  }

  protected sobraDe(id: string): number {
    return this.efetivas().find((b) => b.categoryId === id)?.sobraCents ?? 0;
  }

  protected async mudarSobra(
    categoryId: string,
    ligar: boolean,
  ): Promise<void> {
    const m = this.meta(categoryId);
    if (!m) return;
    try {
      await this.budgetRepo.save(this.uid, categoryId, m.limitCents, ligar);
      this.budgets.update((list) =>
        list.map((b) =>
          b.categoryId === categoryId ? { ...b, rollover: ligar } : b,
        ),
      );
    } catch (e) {
      this.falha(e);
    }
  }

  protected nome(id: string): string {
    return this.categorias().find((c) => c.id === id)?.name ?? id;
  }

  protected paraTexto(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  protected async salvar(categoryId: string, texto: string): Promise<void> {
    this.erro.set('');
    const cents = parseAmountToCents(texto);
    if (cents === null || cents <= 0) {
      this.erro.set('Informe um limite maior que zero, por exemplo 900,00.');
      return;
    }
    const rollover = this.meta(categoryId)?.rollover ?? false;
    try {
      await this.budgetRepo.save(this.uid, categoryId, cents, rollover);
      this.budgets.update((list) => [
        ...list.filter((b) => b.categoryId !== categoryId),
        { categoryId, limitCents: cents, rollover },
      ]);
    } catch (e) {
      this.falha(e);
    }
  }

  protected async remover(categoryId: string): Promise<void> {
    try {
      await this.budgetRepo.remove(this.uid, categoryId);
      this.budgets.update((list) =>
        list.filter((b) => b.categoryId !== categoryId),
      );
    } catch (e) {
      this.falha(e);
    }
  }

  private falha(e: unknown): void {
    this.erro.set(
      e instanceof Error ? e.message : 'Tente de novo em instantes.',
    );
  }
}
