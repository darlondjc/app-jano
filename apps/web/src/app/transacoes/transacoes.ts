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
  CatalogRepository,
  TransactionsRepository,
  slugify,
  type AccountDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import { formatBRL } from '@jano/engine';
import {
  DEFAULT_RULES,
  addDedupeKeys,
  bankCategoryToName,
  decodeBytes,
  isFaturaBB,
  parseFaturaBB,
  parseOfx,
  planImport,
  suggestCategory,
  type FaturaResult,
  type ImportPlan,
} from '@jano/import-file';
import { JanoBanner, JanoButton, JanoCategoryBadge } from '@jano/ui';
import {
  agruparPorDia,
  gastosDoMes,
  mesAnterior,
  mesSeguinte,
  rotuloMes,
} from './agrupar';
import { linhasDoPdf } from './pdf';

interface Previa {
  fileName: string;
  accountId: string;
  plan: ImportPlan;
  erros: { index: number; reason: string }[];
  semSugestao: number;
  fatura?: FaturaResult;
}

@Component({
  selector: 'jano-transacoes',
  imports: [RouterLink, JanoButton, JanoBanner, JanoCategoryBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    .mes {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 4px;
    }
    .mes strong {
      min-width: 140px;
      text-align: center;
      font: 600 16px/24px var(--font-sans);
    }
    .dia {
      margin: 24px 0 8px;
      font: 500 12px/16px var(--font-sans);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-2);
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
    select {
      height: 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: 400 14px/20px var(--font-sans);
      padding: 0 8px;
      max-width: 150px;
    }
    .previa {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .previa dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 16px;
      margin: 0;
    }
    .previa dd {
      margin: 0;
      text-align: right;
    }
    .vazio {
      text-align: center;
      color: var(--text-2);
      padding: 48px 16px;
    }
    input[type='file'] {
      display: none;
    }
  `,
  template: `
    <header>
      <div>
        <a routerLink="/" class="j-cap">← Início</a>
        <h1>Transações</h1>
        <a routerLink="/categorias" class="j-cap">Gerenciar categorias</a>
      </div>
      <label>
        <input
          type="file"
          accept=".ofx,.OFX,.pdf,.PDF"
          (change)="escolherArquivo($event)"
        />
        <span class="j-btn j-btn--primary" role="button" tabindex="0"
          >Importar extrato ou fatura</span
        >
      </label>
    </header>

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
    <div class="j-sub">
      {{ txs().length }} transações · gastos de
      {{ money(gastos()) }} (transferências fora do total)
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }
    @if (aviso()) {
      <jano-banner tone="good">{{ aviso() }}</jano-banner>
    }

    @if (previa(); as p) {
      <section class="j-card previa" aria-label="Prévia da importação">
        <h2 style="margin:0;font:600 18px/24px var(--font-sans)">
          Revisar importação
        </h2>
        <div class="j-sub">{{ p.fileName }}</div>
        <label class="j-field">
          <span class="j-field__label">Importar para</span>
          <select
            [value]="p.accountId"
            (change)="trocarConta($event)"
            aria-label="Conta de destino"
          >
            @for (a of contas(); track a.id) {
              <option [value]="a.id" [selected]="a.id === p.accountId">
                {{ a.nickname }}
              </option>
            }
          </select>
        </label>
        @if (p.fatura; as f) {
          <div class="j-sub">
            Fatura fechada em {{ dataBr(f.meta.closingDate) }} · vence em
            {{ dataBr(f.meta.dueDate) }} · total
            {{ f.meta.totalCents !== null ? money(f.meta.totalCents) : '—' }}
          </div>
          @for (w of f.warnings; track w) {
            <jano-banner tone="warn">{{ w }}</jano-banner>
          }
          @if (!f.warnings.length) {
            <jano-banner tone="good"
              >As somas batem com os subtotais da fatura.</jano-banner
            >
          }
        }
        <dl>
          <dt>Novas</dt>
          <dd class="j-num">
            <b>{{ p.plan.fresh.length }}</b>
          </dd>
          <dt>Já importadas antes</dt>
          <dd class="j-num">{{ p.plan.duplicates.length }}</dd>
          <dt>Sem categoria sugerida</dt>
          <dd class="j-num">{{ p.semSugestao }}</dd>
          <dt>Linhas com problema</dt>
          <dd class="j-num">{{ p.erros.length }}</dd>
        </dl>
        @if (p.erros.length) {
          <jano-banner tone="warn">
            {{ p.erros.length }} linhas ficaram de fora: {{ p.erros[0].reason }}
          </jano-banner>
        }
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button
            janoButton
            variant="secondary"
            type="button"
            (click)="cancelar()"
          >
            Cancelar
          </button>
          <button
            janoButton
            variant="primary"
            type="button"
            [disabled]="ocupado() || !p.plan.fresh.length"
            (click)="confirmar()"
          >
            {{
              ocupado()
                ? 'Gravando...'
                : 'Importar ' + p.plan.fresh.length + ' transações'
            }}
          </button>
        </div>
      </section>
    }

    @if (carregando()) {
      <p class="vazio">Carregando...</p>
    } @else if (!txs().length) {
      <p class="vazio">
        Nenhuma transação neste mês. Importe um extrato OFX do Banco do Brasil
        para começar.
      </p>
    } @else {
      @for (g of grupos(); track g.date) {
        <div class="dia">{{ g.label }}</div>
        <div class="lista">
          @for (t of g.items; track t.id) {
            <div class="j-tx" style="grid-template-columns: auto 1fr auto auto">
              <jano-category-badge
                [icon]="cat(t.categoryId)?.icon ?? 'etiqueta'"
                [colorToken]="cat(t.categoryId)?.color ?? 'cat-1'"
                [size]="32"
              />
              <div>
                <div class="j-tx__name">{{ t.description }}</div>
                <div class="j-tx__sub">{{ nomeConta(t.accountId) }}</div>
              </div>
              <select
                [attr.aria-label]="'Categoria de ' + t.description"
                (change)="categorizar(t, $event)"
              >
                <option value="" [selected]="!t.categoryId">
                  Sem categoria
                </option>
                @for (c of categorias(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === t.categoryId">
                    {{ c.name }}
                  </option>
                }
              </select>
              <div
                [class]="
                  'j-tx__amount j-num' + (t.amountCents > 0 ? ' entrada' : '')
                "
                style="margin-left:12px"
              >
                {{ t.amountCents > 0 ? '+' : '' }}{{ money(t.amountCents) }}
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class Transacoes {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(TransactionsRepository);
  private readonly catalog = inject(CatalogRepository);

  protected readonly money = formatBRL;
  protected readonly month = signal(new Date().toISOString().slice(0, 7));
  protected readonly txs = signal<TransactionDoc[]>([]);
  protected readonly contas = signal<AccountDoc[]>([]);
  protected readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly erro = signal('');
  protected readonly aviso = signal('');
  protected readonly previa = signal<Previa | null>(null);
  private arquivoKeyed: ReturnType<typeof addDedupeKeys> = [];

  protected readonly rotulo = computed(() => rotuloMes(this.month()));
  protected readonly grupos = computed(() => agruparPorDia(this.txs()));
  protected readonly gastos = computed(() => gastosDoMes(this.txs()));

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
      const [contas, categorias] = await Promise.all([
        this.catalog.accounts(this.uid),
        this.catalog.categories(this.uid),
      ]);
      this.contas.set(contas);
      this.categorias.set(categorias);
      await this.carregar();
    } catch (e) {
      this.falha(e);
    }
  }

  private async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.txs.set(await this.repo.listMonth(this.uid, this.month()));
    } catch (e) {
      this.falha(e);
    } finally {
      this.carregando.set(false);
    }
  }

  protected mudarMes(delta: 1 | -1): void {
    this.month.update((m) => (delta === 1 ? mesSeguinte(m) : mesAnterior(m)));
    void this.carregar();
  }

  protected cat(id: string | null): CategoryDoc | undefined {
    return id ? this.categorias().find((c) => c.id === id) : undefined;
  }

  protected nomeConta(id: string): string {
    return this.contas().find((c) => c.id === id)?.nickname ?? '';
  }

  protected async categorizar(t: TransactionDoc, ev: Event): Promise<void> {
    const categoryId = (ev.target as HTMLSelectElement).value || null;
    try {
      await this.repo.setCategory(this.uid, t.id, categoryId);
      this.txs.update((list) =>
        list.map((x) =>
          x.id === t.id ? { ...x, categoryId, categoryIsManual: true } : x,
        ),
      );
    } catch (e) {
      this.falha(e);
    }
  }

  protected async escolherArquivo(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.erro.set('');
    this.aviso.set('');
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('O arquivo passa de 10 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ehPdf = /\.pdf$/i.test(file.name);
      let fatura: FaturaResult | undefined;
      let parsed: {
        transactions: Parameters<typeof addDedupeKeys>[1];
        errors: Previa['erros'];
      };
      if (ehPdf) {
        const linhas = await linhasDoPdf(bytes);
        if (!isFaturaBB(linhas)) {
          throw new Error(
            'Este PDF não parece uma fatura de cartão do Banco do Brasil.',
          );
        }
        fatura = parseFaturaBB(linhas);
        parsed = fatura;
      } else {
        parsed = parseOfx(decodeBytes(bytes));
      }
      if (!parsed.transactions.length) {
        throw new Error(
          'Não encontrei transações neste arquivo. Use o OFX do extrato ou o PDF da fatura.',
        );
      }
      const contas = this.contas();
      const accountId = ehPdf
        ? (contas.find((c) => c.type === 'cartao')?.id ?? contas[0]?.id ?? '')
        : (this.previa()?.accountId ?? contas[0]?.id ?? '');
      this.fatura = fatura;
      await this.montarPrevia(
        file.name,
        accountId,
        parsed.transactions,
        parsed.errors,
      );
    } catch (e) {
      this.falha(e);
    }
  }

  private fatura?: FaturaResult;
  private raw: Parameters<typeof addDedupeKeys>[1] = [];
  private errosArquivo: Previa['erros'] = [];

  private async montarPrevia(
    fileName: string,
    accountId: string,
    rows: Parameters<typeof addDedupeKeys>[1],
    erros: Previa['erros'],
  ): Promise<void> {
    this.raw = rows;
    this.errosArquivo = erros;
    this.arquivoKeyed = addDedupeKeys(accountId, rows);
    const dates = rows.map((r) => r.date).sort();
    const existentes = await this.repo.existingKeys(
      this.uid,
      dates[0],
      dates[dates.length - 1],
    );
    const plan = planImport(this.arquivoKeyed, existentes);
    const semSugestao = plan.fresh.filter((t) => !this.nomeCategoria(t)).length;
    this.previa.set({
      fileName,
      accountId,
      plan,
      erros,
      semSugestao,
      fatura: this.fatura,
    });
  }

  protected async trocarConta(ev: Event): Promise<void> {
    const p = this.previa();
    if (!p) return;
    try {
      await this.montarPrevia(
        p.fileName,
        (ev.target as HTMLSelectElement).value,
        this.raw,
        this.errosArquivo,
      );
    } catch (e) {
      this.falha(e);
    }
  }

  private nomeCategoria(tx: {
    descriptionNorm: string;
    bankCategory?: string;
    isTransfer?: boolean;
  }): string | null {
    if (tx.isTransfer) return null;
    return (
      suggestCategory(tx.descriptionNorm, DEFAULT_RULES) ??
      bankCategoryToName(tx.bankCategory)
    );
  }

  protected dataBr(iso: string | null): string {
    return iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  protected cancelar(): void {
    this.previa.set(null);
  }

  protected async confirmar(): Promise<void> {
    const p = this.previa();
    if (!p) return;
    this.ocupado.set(true);
    try {
      const catIds = new Set(this.categorias().map((c) => c.id));
      const rows = p.plan.fresh.map((tx) => {
        const nome = this.nomeCategoria(tx);
        const id = nome ? slugify(nome) : null;
        return { tx, categoryId: id && catIds.has(id) ? id : null };
      });
      const importId = crypto.randomUUID();
      await this.repo.commitImport(this.uid, p.accountId, importId, rows);
      await this.catalog.saveImportRecord(this.uid, importId, {
        accountId: p.accountId,
        fileName: p.fileName,
        added: rows.length,
        duplicates: p.plan.duplicates.length,
        errors: p.erros.length,
        createdAt: new Date().toISOString(),
      });
      this.previa.set(null);
      this.aviso.set(`${rows.length} transações importadas.`);
      if (p.plan.from) this.month.set(p.plan.from.slice(0, 7));
      await this.carregar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  private falha(e: unknown): void {
    this.erro.set(
      e instanceof Error ? e.message : 'Tente de novo em instantes.',
    );
  }
}
