import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import type { CategoryDoc, TransactionDoc } from '@jano/data-access';
import { formatBRL, validarDivisao } from '@jano/engine';
import {
  estabelecimento,
  nomeSemPrefixo,
  normalizeDescription,
  parseAmountToCents,
  regraGenerica,
} from '@jano/import-file';
import { JanoBanner, JanoButton } from '@jano/ui';
import { classeValor, dayLabel } from './agrupar';

export const TRANSFERENCIA = '__transferencia__';

export interface SalvarDetalhe {
  /** Id da categoria, TRANSFERENCIA ou null (sem categoria). */
  escolha: string | null;
  /**
   * Outras transações com o mesmo nome: `passadas` muda as já gravadas, `futuras` cria a
   * regra para as que chegarem. `pattern` já vem normalizado (maiúsculas, sem acento).
   */
  regra: {
    pattern: string;
    categoryId: string;
    passadas: boolean;
    futuras: boolean;
  } | null;
  /** Partes da divisão, já conferidas e com o sinal do lançamento; ausente = sem divisão. */
  divisao?: { categoryId: string; amountCents: number }[];
}

/** Mensagem depois de salvar, contando as outras transações alteradas. */
export function avisoDoSalvar(
  regra: SalvarDetalhe['regra'],
  passadas: number,
): string {
  if (!regra) return 'Salvo.';
  const partes: string[] = [];
  if (regra.passadas)
    partes.push(
      passadas === 1
        ? '1 transação passada alterada'
        : `${passadas} transações passadas alteradas`,
    );
  if (regra.futuras) partes.push('as próximas com esse nome já chegam assim');
  const texto = partes.join('; ');
  return `Salvo: ${texto}.`;
}

interface LinhaDivisao {
  categoryId: string | null;
  /** Valor como digitado, sem sinal ("420,00"). */
  texto: string;
}

const emReais = (cents: number): string =>
  (Math.abs(cents) / 100).toFixed(2).replace('.', ',');

/** Painel de uma transação: categoria, transferência e a mesma categoria para outras com o mesmo nome. */
@Component({
  selector: 'jano-detalhe-transacao',
  imports: [JanoBanner, JanoButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .topo > div {
      flex: 1;
      min-width: 0;
    }
    .nome {
      display: flex;
      align-items: flex-start;
      gap: 4px;
    }
    h2 {
      margin: 0;
      font: 600 18px/24px var(--font-sans);
      overflow-wrap: anywhere;
    }
    .original {
      margin-top: 2px;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .valor {
      font: 600 28px/36px var(--font-sans);
      font-variant-numeric: tabular-nums;
    }
    .rotulo-linha {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .link {
      border: 0;
      padding: 4px 0;
      background: none;
      color: var(--primary-text);
      font: 500 14px/20px var(--font-sans);
      cursor: pointer;
    }
    .link:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-height: 184px;
      overflow: auto;
      padding: 2px;
    }
    .chips .j-chip {
      height: 30px;
      padding: 0 10px;
    }
    /* Categorias de entrada em verde, como os valores que entram. */
    .chips .j-chip.receita {
      color: var(--positive);
      border-color: var(--positive);
    }
    .chips .j-chip.receita[aria-pressed='true'] {
      background: var(--positive-soft);
    }
    .regra {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: var(--surface-2);
      border-radius: var(--radius-md);
      font: 400 14px/20px var(--font-sans);
    }
    .regra label.chk {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-height: 32px;
    }
    .icone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-2);
      cursor: pointer;
    }
    .icone:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .icone:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .icone svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .copiado {
      color: var(--positive);
    }
    .campo-trecho {
      padding-right: 4px;
    }
    .aviso-trecho {
      color: var(--danger);
    }
    .regra input[type='checkbox'] {
      accent-color: var(--primary);
      width: 18px;
      height: 18px;
      margin-top: 1px;
    }
    .dividir-topo {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .partes {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .parte {
      display: grid;
      grid-template-columns: 1fr 112px auto;
      gap: 8px;
      align-items: center;
    }
    .parte select {
      width: 100%;
      min-width: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
    }
    .situacao {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    /* Salvar sempre à vista: fica preso ao pé do painel enquanto o resto rola. */
    .acoes {
      position: sticky;
      bottom: 0;
      z-index: 1;
      display: flex;
      gap: 8px;
      margin: 0 -16px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: var(--surface);
      border-top: 1px solid var(--border);
    }
    .acoes button:first-child {
      flex: 1;
    }
  `,
  template: `
    <div class="topo">
      <div>
        <div class="nome">
          <h2>{{ nome() }}</h2>
          <button
            class="icone"
            [class.copiado]="copiado()"
            type="button"
            [attr.aria-label]="copiado() ? 'Nome copiado' : 'Copiar nome'"
            [title]="copiado() ? 'Copiado' : 'Copiar nome'"
            (click)="copiar()"
          >
            @if (copiado()) {
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            } @else {
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            }
          </button>
        </div>
        @if (nome() !== tx().description) {
          <div class="original">{{ tx().description }}</div>
        }
        <div class="j-sub">{{ data() }} · {{ conta() }}</div>
      </div>
      <button
        class="icone"
        type="button"
        aria-label="Fechar detalhe"
        title="Fechar"
        (click)="fechar.emit()"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div [class]="'valor ' + cor()">
      {{ tx().amountCents > 0 ? '+' : '' }}{{ money(tx().amountCents) }}
    </div>

    @if (
      !dividindo() && !tx().categoryId && !tx().isTransfer && escolha() === null
    ) {
      <jano-banner tone="info" title="Sem categoria.">
        Escolha uma abaixo. Dá para aplicar a mesma categoria às outras
        transações com esse nome.
      </jano-banner>
    }

    @if (!dividindo()) {
      <div>
        <div class="rotulo-linha">
          <span class="j-field__label">Categoria</span>
          @if (tx().amountCents < 0) {
            <button class="link" type="button" (click)="dividir()">
              Dividir em categorias
            </button>
          }
        </div>
        <div class="chips" role="group" aria-label="Categoria">
          @for (c of categoriasNaOrdem(); track c.id) {
            <button
              class="j-chip"
              [class.receita]="c.type === 'receita'"
              type="button"
              [attr.aria-pressed]="escolha() === c.id"
              (click)="escolher(c.id)"
            >
              {{ c.name }}
            </button>
          }
          <button
            class="j-chip"
            type="button"
            [attr.aria-pressed]="escolha() === transferencia"
            (click)="escolher(transferencia)"
          >
            Transferência (fora dos totais)
          </button>
        </div>
      </div>
    }

    @if (dividindo()) {
      <div>
        <div class="dividir-topo">
          <span class="j-field__label">Dividir em categorias</span>
          <span class="j-cap">Total {{ money(-tx().amountCents) }}</span>
        </div>
        <div class="partes">
          @for (l of linhas(); track $index; let i = $index) {
            <div class="parte">
              <span class="j-input">
                <select
                  [attr.aria-label]="'Categoria ' + (i + 1)"
                  (change)="
                    mudarParte(i, {
                      categoryId: $any($event.target).value || null,
                    })
                  "
                >
                  <option value="" [selected]="!l.categoryId">Categoria</option>
                  @for (c of categorias(); track c.id) {
                    <option [value]="c.id" [selected]="l.categoryId === c.id">
                      {{ c.name }}
                    </option>
                  }
                </select>
              </span>
              <span class="j-input">
                <span class="j-input__prefix">R$</span>
                <input
                  inputmode="decimal"
                  placeholder="0,00"
                  [attr.aria-label]="'Valor ' + (i + 1)"
                  [value]="l.texto"
                  (input)="mudarParte(i, { texto: $any($event.target).value })"
                />
              </span>
              <button
                janoButton
                variant="ghost"
                [small]="true"
                type="button"
                [attr.aria-label]="'Remover parte ' + (i + 1)"
                [disabled]="linhas().length <= 2"
                (click)="removerParte(i)"
              >
                ×
              </button>
            </div>
          }
        </div>
        <div class="situacao">
          <button
            janoButton
            variant="ghost"
            [small]="true"
            type="button"
            (click)="adicionarParte()"
          >
            + Adicionar categoria
          </button>
          <span class="j-cap" aria-live="polite">{{ situacao() }}</span>
        </div>
        <button
          janoButton
          variant="ghost"
          [small]="true"
          type="button"
          (click)="dividindo.set(false)"
        >
          {{ tx().splits?.length ? 'Desfazer divisão' : 'Cancelar divisão' }}
        </button>
      </div>
    }

    @if (podeRegra() && !dividindo()) {
      <div class="regra">
        <label class="chk">
          <input
            type="checkbox"
            [checked]="passadas()"
            (change)="passadas.set($any($event.target).checked)"
          />
          <span>Alterar também as transações passadas</span>
        </label>
        <label class="chk">
          <input
            type="checkbox"
            [checked]="futuras()"
            (change)="futuras.set($any($event.target).checked)"
          />
          <span>Alterar também as transações futuras</span>
        </label>
        @if (passadas() || futuras()) {
          <label class="j-field">
            <span class="j-field__label">Transações com o nome contendo</span>
            <span
              class="j-input campo-trecho"
              [class.j-input--error]="trechoGenerico()"
            >
              <input
                #trecho
                [value]="padrao()"
                (input)="padrao.set($any($event.target).value)"
                aria-label="Trecho do nome"
              />
              @if (padrao()) {
                <button
                  class="icone"
                  type="button"
                  aria-label="Limpar trecho"
                  (click)="padrao.set(''); trecho.focus()"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              }
            </span>
          </label>
          @if (trechoGenerico()) {
            <span class="j-cap aviso-trecho" role="alert">
              Inclua o nome da loja: esse trecho pegaria quase todas as
              transações.
            </span>
          }
        }
      </div>
    }

    <div class="acoes">
      <button
        janoButton
        variant="primary"
        type="button"
        [disabled]="!mudou()"
        (click)="salvarClick()"
      >
        Salvar
      </button>
    </div>
  `,
})
export class DetalheTransacao {
  readonly tx = input.required<TransactionDoc>();
  readonly categorias = input.required<CategoryDoc[]>();
  readonly conta = input('');
  readonly fechar = output<void>();
  readonly salvar = output<SalvarDetalhe>();

  protected readonly transferencia = TRANSFERENCIA;
  protected readonly money = formatBRL;

  /** Escolha atual; recomeça da situação gravada quando outra transação abre. */
  protected readonly escolha = linkedSignal<string | null>(() =>
    this.tx().isTransfer ? TRANSFERENCIA : this.tx().categoryId,
  );
  protected readonly passadas = linkedSignal<boolean>(() => {
    this.tx();
    return false;
  });
  protected readonly futuras = linkedSignal<boolean>(() => {
    this.tx();
    return false;
  });
  /** Nome da loja, sem "COMPRA C CARTAO 17 15", que pegaria todas as compras no débito. */
  protected readonly padrao = linkedSignal<string>(() =>
    estabelecimento(this.tx().descriptionNorm),
  );
  /** O trecho como será comparado: maiúsculas, sem acento nem pontuação. */
  private readonly trechoNorm = computed(() =>
    normalizeDescription(this.padrao()),
  );
  protected readonly trechoGenerico = computed(() =>
    regraGenerica(this.trechoNorm()),
  );
  private readonly outras = computed(
    () => this.podeRegra() && (this.passadas() || this.futuras()),
  );
  protected readonly copiado = signal(false);

  /** Editor de divisão aberto; abre sozinho quando o lançamento já é dividido. */
  protected readonly dividindo = linkedSignal<boolean>(
    () => !!this.tx().splits?.length,
  );
  protected readonly linhas = linkedSignal<LinhaDivisao[]>(() => {
    const t = this.tx();
    return t.splits?.length
      ? t.splits.map((p) => ({
          categoryId: p.categoryId,
          texto: emReais(p.amountCents),
        }))
      : [
          { categoryId: t.categoryId, texto: emReais(t.amountCents) },
          { categoryId: null, texto: '' },
        ];
  });
  /** Partes com o sinal do lançamento, como seriam gravadas. */
  private readonly partes = computed(() =>
    this.linhas().map((l) => ({
      categoryId: l.categoryId,
      amountCents: -Math.abs(parseAmountToCents(l.texto) ?? 0),
    })),
  );
  protected readonly divisao = computed(() =>
    validarDivisao(this.tx().amountCents, this.partes()),
  );
  protected readonly situacao = computed(() => {
    const r = this.divisao();
    if (r.ok) return 'As partes fecham o total.';
    if (r.faltaCents !== undefined)
      return r.faltaCents > 0
        ? `Faltam ${formatBRL(r.faltaCents)}.`
        : `Passou ${formatBRL(-r.faltaCents)}.`;
    return r.motivo;
  });

  protected readonly data = computed(() => dayLabel(this.tx().date));
  protected readonly nome = computed(() =>
    nomeSemPrefixo(this.tx().description),
  );
  /** As do tipo do lançamento primeiro (despesas num gasto, receitas numa entrada). */
  protected readonly categoriasNaOrdem = computed(() => {
    const tipo = this.tx().amountCents > 0 ? 'receita' : 'despesa';
    return [...this.categorias()].sort(
      (a, b) => Number(b.type === tipo) - Number(a.type === tipo),
    );
  });
  protected readonly cor = computed(
    () => classeValor(this.tx()).split(' ').pop() as string,
  );
  protected readonly podeRegra = computed(
    () => !!this.escolha() && this.escolha() !== TRANSFERENCIA,
  );
  protected readonly mudou = computed(() => {
    const t = this.tx();
    const dividido = !!t.splits?.length;
    if (this.dividindo())
      return (
        this.divisao().ok &&
        JSON.stringify(this.partes()) !== JSON.stringify(t.splits ?? null)
      );
    if (dividido) return true; // desfazer a divisão
    const atual = t.isTransfer ? TRANSFERENCIA : t.categoryId;
    if (this.outras() && this.trechoGenerico()) return false;
    return this.escolha() !== atual || this.outras();
  });

  protected dividir(): void {
    this.dividindo.set(true);
  }

  protected mudarParte(i: number, mudanca: Partial<LinhaDivisao>): void {
    this.linhas.update((l) =>
      l.map((x, j) => (j === i ? { ...x, ...mudanca } : x)),
    );
  }

  protected adicionarParte(): void {
    const r = this.divisao();
    const falta = !r.ok && r.faltaCents && r.faltaCents > 0 ? r.faltaCents : 0;
    this.linhas.update((l) => [
      ...l,
      { categoryId: null, texto: falta ? emReais(falta) : '' },
    ]);
  }

  protected removerParte(i: number): void {
    this.linhas.update((l) => l.filter((_, j) => j !== i));
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.tx().description);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o nome continua selecionável na tela.
    }
  }

  protected escolher(id: string): void {
    this.escolha.set(id);
  }

  protected salvarClick(): void {
    if (this.dividindo()) {
      this.salvar.emit({
        escolha: null,
        regra: null,
        divisao: this.partes() as { categoryId: string; amountCents: number }[],
      });
      return;
    }
    const escolha = this.escolha();
    this.salvar.emit({
      escolha,
      regra:
        this.outras() && !this.trechoGenerico()
          ? {
              pattern: this.trechoNorm(),
              categoryId: escolha as string,
              passadas: this.passadas(),
              futuras: this.futuras(),
            }
          : null,
    });
  }
}
