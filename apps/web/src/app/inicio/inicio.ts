import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  daysLeftInMonth,
  formatBRL,
  monthPace,
  monthTotals,
  tightestGoals,
} from '@jano/engine';
import { JanoBanner, JanoButton, JanoGoalBar, JanoKpiCard } from '@jano/ui';
import { rotuloMes } from '../transacoes/agrupar';

@Component({
  selector: 'jano-inicio',
  imports: [RouterLink, JanoButton, JanoBanner, JanoGoalBar, JanoKpiCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    h2 {
      margin: 32px 0 12px;
      font: 600 18px/24px var(--font-sans);
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    h2 a {
      font: 500 14px/20px var(--font-sans);
      color: var(--primary-text);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .metas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .lista {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .lista .j-tx:last-child {
      border-bottom: 0;
    }
    .entrada {
      color: var(--positive);
    }
    .vazio {
      margin-top: 24px;
    }
    nav {
      display: flex;
      gap: 8px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
  `,
  template: `
    <header>
      <div>
        <h1>Olá, {{ nome() }}</h1>
        <div class="j-sub">{{ mes() }}</div>
      </div>
      <button janoButton variant="ghost" type="button" (click)="sair()">
        Sair
      </button>
    </header>

    <nav aria-label="Seções">
      <a janoButton variant="secondary" routerLink="/transacoes">Transações</a>
      <a janoButton variant="secondary" routerLink="/orcamento">Orçamento</a>
    </nav>

    @if (erro()) {
      <jano-banner tone="danger" title="Não consegui carregar seus dados.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <p class="j-sub vazio">Carregando seu mês...</p>
    } @else if (!txs().length) {
      <div class="j-card vazio">
        <h2 style="margin:0 0 8px">Vamos começar</h2>
        <p class="j-sub" style="margin:0 0 16px">
          Seu mês aparece aqui assim que você importar o extrato (OFX) da conta
          ou do cartão.
        </p>
        <a janoButton variant="primary" routerLink="/transacoes"
          >Importar extrato</a
        >
      </div>
    } @else {
      <section class="kpis" aria-label="Resumo do mês">
        <jano-kpi-card
          label="Sobra do mês"
          [valueCents]="totais().net"
          [balance]="true"
        >
          <div class="j-sub">receitas menos gastos até agora</div>
        </jano-kpi-card>
        <jano-kpi-card label="Gastos" [valueCents]="totais().spent" />
        <jano-kpi-card label="Receitas" [valueCents]="totais().income" />
      </section>

      <h2>Metas mais apertadas <a routerLink="/orcamento">Ver todas</a></h2>
      @if (apertadas().length) {
        <div class="metas">
          @for (m of apertadas(); track m.categoryId) {
            <jano-goal-bar
              [name]="nomeCategoria(m.categoryId)"
              [spentCents]="m.spentCents"
              [limitCents]="m.limitCents"
              [pace]="pace()"
              [daysLeft]="daysLeft()"
            />
          }
        </div>
      } @else {
        <p class="j-sub">
          Você ainda não definiu metas.
          <a routerLink="/orcamento">Criar a primeira</a>.
        </p>
      }

      <h2>Últimas transações <a routerLink="/transacoes">Ver todas</a></h2>
      <div class="lista">
        @for (t of recentes(); track t.id) {
          <div class="j-tx" style="grid-template-columns: 1fr auto">
            <div>
              <div class="j-tx__name">{{ t.description }}</div>
              <div class="j-tx__sub">
                {{ dia(t.date) }} · {{ nomeCategoria(t.categoryId) }}
              </div>
            </div>
            <div
              [class]="
                'j-tx__amount j-num' + (t.amountCents > 0 ? ' entrada' : '')
              "
            >
              {{ t.amountCents > 0 ? '+' : '' }}{{ money(t.amountCents) }}
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);

  protected readonly money = formatBRL;
  private readonly hoje = new Date();
  private readonly month = this.hoje.toISOString().slice(0, 7);
  protected readonly mes = computed(() => rotuloMes(this.month));
  protected readonly txs = signal<TransactionDoc[]>([]);
  private readonly budgets = signal<BudgetDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  protected readonly totais = computed(() => monthTotals(this.txs()));
  protected readonly apertadas = computed(() =>
    tightestGoals(budgetRows(this.budgets(), this.totais().spentByCategory), 3),
  );
  protected readonly recentes = computed(() =>
    [...this.txs()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  );
  protected readonly pace = signal(
    monthPace(
      this.hoje.getFullYear(),
      this.hoje.getMonth() + 1,
      this.hoje.getDate(),
    ),
  );
  protected readonly daysLeft = signal(
    daysLeftInMonth(
      this.hoje.getFullYear(),
      this.hoje.getMonth() + 1,
      this.hoje.getDate(),
    ),
  );

  constructor() {
    void this.carregar();
  }

  protected nome(): string {
    return this.auth.user()?.displayName?.split(' ')[0] ?? '';
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

  private async carregar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    try {
      const [txs, budgets, cats] = await Promise.all([
        this.txRepo.listMonth(uid, this.month),
        this.budgetRepo.list(uid),
        this.catalog.categories(uid),
      ]);
      this.txs.set(txs);
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

  protected async sair(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
