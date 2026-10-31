import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import type { CategoryDoc, TransactionDoc } from '@jano/data-access';
import { formatBRL, validarDivisao } from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import { JanoBanner, JanoButton } from '@jano/ui';
import { classeValor, dayLabel } from './agrupar';

export const TRANSFERENCIA = '__transferencia__';

export interface SalvarDetalhe {
  /** Id da categoria, TRANSFERENCIA ou null (sem categoria). */
  escolha: string | null;
  regra: { pattern: string; categoryId: string } | null;
  /** Partes da divisão, já conferidas e com o sinal do lançamento; ausente = sem divisão. */
  divisao?: { categoryId: string; amountCents: number }[];
}

interface LinhaDivisao {
  categoryId: string | null;
  /** Valor como digitado, sem sinal ("420,00"). */
  texto: string;
}

const emReais = (cents: number): string =>
  (Math.abs(cents) / 100).toFixed(2).replace('.', ',');

/** Painel de uma transação: categoria, transferência e regra para as próximas. */
@Component({
  selector: 'jano-detalhe-transacao',
  imports: [JanoBanner, JanoButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font: 600 20px/28px var(--font-sans);
      word-break: break-word;
    }
    .valor {
      font: 600 32px/40px var(--font-sans);
      font-variant-numeric: tabular-nums;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      max-height: 220px;
      overflow: auto;
      padding: 2px;
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
    .acoes {
      display: flex;
      gap: 8px;
    }
    .acoes button:first-child {
      flex: 1;
    }
  `,
  template: `
    <div class="topo">
      <div>
        <h2>{{ tx().description }}</h2>
        <div class="j-sub">{{ data() }} · {{ conta() }}</div>
      </div>
      <button
        janoButton
        variant="ghost"
        [small]="true"
        type="button"
        aria-label="Fechar detalhe"
        (click)="fechar.emit()"
      >
        Fechar
      </button>
    </div>

    <div [class]="'valor ' + cor()">
      {{ tx().amountCents > 0 ? '+' : '' }}{{ money(tx().amountCents) }}
    </div>

    @if (
      !dividindo() && !tx().categoryId && !tx().isTransfer && escolha() === null
    ) {
      <jano-banner tone="info" title="Sem categoria.">
        Escolha uma abaixo. Se marcar a regra, o Jano lembra nas próximas
        importações.
      </jano-banner>
    }

    @if (!dividindo()) {
      <div>
        <div class="j-field__label" style="margin-bottom: 8px">Categoria</div>
        <div class="chips" role="group" aria-label="Categoria">
          @for (c of categorias(); track c.id) {
            <button
              class="j-chip"
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

    @if (tx().amountCents < 0) {
      <div>
        <div class="dividir-topo">
          <span class="j-field__label">Dividir em categorias</span>
          <span class="j-cap">Total {{ money(-tx().amountCents) }}</span>
        </div>
        @if (dividindo()) {
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
                    <option value="" [selected]="!l.categoryId">
                      Categoria
                    </option>
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
                    (input)="
                      mudarParte(i, { texto: $any($event.target).value })
                    "
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
        } @else {
          <button
            janoButton
            variant="secondary"
            [small]="true"
            type="button"
            (click)="dividir()"
          >
            Dividir em categorias
          </button>
        }
      </div>
    }

    @if (podeRegra() && !dividindo()) {
      <div class="regra">
        <label class="chk">
          <input
            type="checkbox"
            [checked]="criarRegra()"
            (change)="criarRegra.set($any($event.target).checked)"
          />
          <span>Criar regra para as próximas e aplicar às deste período</span>
        </label>
        @if (criarRegra()) {
          <label class="j-field">
            <span class="j-field__label">Sempre que a descrição contiver</span>
            <span class="j-input"
              ><input
                [value]="padrao()"
                (input)="padrao.set($any($event.target).value)"
                aria-label="Trecho da regra"
            /></span>
          </label>
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
  protected readonly criarRegra = linkedSignal<boolean>(() => {
    this.tx();
    return false;
  });
  protected readonly padrao = linkedSignal<string>(() =>
    this.tx().descriptionNorm.split(' ').slice(0, 3).join(' '),
  );

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
    return this.escolha() !== atual || (this.podeRegra() && this.criarRegra());
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
    const pattern = this.padrao().trim();
    this.salvar.emit({
      escolha,
      regra:
        this.podeRegra() && this.criarRegra() && pattern.length >= 3
          ? { pattern, categoryId: escolha as string }
          : null,
    });
  }
}
