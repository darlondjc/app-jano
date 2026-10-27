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
} from '@jano/data-access';
import {
  budgetRows,
  daysLeftInMonth,
  formatBRL,
  monthPace,
  monthTotals,
} from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import { JanoBanner, JanoButton, JanoGoalBar, JanoKpiCard } from '@jano/ui';
import { mesAnterior, mesSeguinte, rotuloMes } from '../transacoes/agrupar';

@Component({
  selector: 'jano-orcamento',
  imports: [RouterLink, JanoButton, JanoBanner, JanoGoalBar, JanoKpiCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    .mes {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0;
    }
    .mes strong {
      min-width: 140px;
      text-align: center;
      font: 600 16px/24px var(--font-sans);
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
    <a janoButton variant="ghost" [small]="true" routerLink="/">‹ Início</a>
    <h1>Orçamento</h1>
    <div class="mes">
      <button
        janoButton
        variant="ghost"
        type="button"
        aria-label="Mês anterior"
        (click)="mudarMes(-1)"
      >
        ‹
      </button>
      <strong>{{ rotulo() }}</strong>
      <button
        janoButton
        variant="ghost"
        type="button"
        aria-label="Próximo mês"
        (click)="mudarMes(1)"
      >
        ›
      </button>
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }

    <jano-kpi-card label="Gasto do mês" [valueCents]="totais().spent">
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
          />
          <div class="edicao">
            <label class="j-sr" [for]="'lim-' + l.categoryId"
              >Limite de {{ nome(l.categoryId) }}</label
            >
            <span class="j-input">
              <span class="j-input__prefix">R$</span>
              <input
                [id]="'lim-' + l.categoryId"
                [value]="paraTexto(l.limitCents)"
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

    @if (semMeta().length) {
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
  protected readonly totais = signal(monthTotals([]));
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly rotulo = computed(() => rotuloMes(this.month()));
  protected readonly linhas = computed(() =>
    budgetRows(this.budgets(), this.totais().spentByCategory).sort(
      (a, b) =>
        b.spentCents / (b.limitCents || 1) - a.spentCents / (a.limitCents || 1),
    ),
  );
  protected readonly limiteTotal = computed(() =>
    this.budgets().reduce((s, b) => s + b.limitCents, 0),
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
      const [cats, budgets] = await Promise.all([
        this.catalog.categories(this.uid),
        this.budgetRepo.list(this.uid),
      ]);
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
      this.totais.set(
        monthTotals(await this.txRepo.listMonth(this.uid, this.month())),
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
    try {
      await this.budgetRepo.save(this.uid, categoryId, cents);
      this.budgets.update((list) => [
        ...list.filter((b) => b.categoryId !== categoryId),
        { categoryId, limitCents: cents },
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
