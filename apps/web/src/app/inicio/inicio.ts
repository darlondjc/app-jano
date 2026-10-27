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
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoGoalBar,
  JanoKpiCard,
} from '@jano/ui';
import { haNovidades } from '../versao/novidades';
import { VERSAO_ATUAL } from '../versao/changelog';
import { classeValor, rotuloMes } from '../transacoes/agrupar';

@Component({
  selector: 'jano-inicio',
  imports: [
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoGoalBar,
    JanoKpiCard,
    JanoCategoryBadge,
  ],
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
    .vazio-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
    .vazio {
      margin-top: 24px;
    }
    .ponto {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-left: 6px;
      border-radius: 50%;
      background: var(--primary);
    }
    .versao {
      margin-top: 32px;
      text-align: center;
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
      <a janoButton variant="secondary" routerLink="/categorias">Categorias</a>
      <a janoButton variant="ghost" routerLink="/novidades"
        >Novidades
        @if (novidades) {
          <span class="ponto" aria-label="há novidades"></span>
        }
      </a>
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
          tone="auto"
        >
          <div class="j-sub">receitas menos gastos até agora</div>
        </jano-kpi-card>
        <jano-kpi-card label="Gastos" [valueCents]="totais().spent" tone="out">
          <div class="j-sub">tudo que saiu no mês, sem transferências</div>
        </jano-kpi-card>
        <jano-kpi-card
          label="Receitas"
          [valueCents]="totais().income"
          tone="in"
        >
          <div class="j-sub">tudo que entrou no mês, sem transferências</div>
        </jano-kpi-card>
      </section>

      <h2>
        Metas mais apertadas
        <a janoButton variant="ghost" [small]="true" routerLink="/orcamento"
          >Ver todas ›</a
        >
      </h2>
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
        <div class="j-card vazio-meta">
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

      <h2>
        Últimas transações
        <a janoButton variant="ghost" [small]="true" routerLink="/transacoes"
          >Ver todas ›</a
        >
      </h2>
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
                {{ dia(t.date) }} · {{ nomeCategoria(t.categoryId) }}
              </div>
            </div>
            <div [class]="classeValor(t)">
              {{ t.amountCents > 0 ? '+' : '' }}{{ money(t.amountCents) }}
            </div>
          </div>
        }
      </div>
    }

    <p class="j-sub versao">Jano v{{ versao }}</p>
  `,
})
export class Inicio {
  protected readonly novidades = haNovidades();
  protected readonly versao = VERSAO_ATUAL;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly budgetRepo = inject(BudgetsRepository);
  private readonly catalog = inject(CatalogRepository);

  protected readonly money = formatBRL;
  protected readonly classeValor = classeValor;
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
