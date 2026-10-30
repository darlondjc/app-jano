import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import type { CategoryDoc, TransactionDoc } from '@jano/data-access';
import { formatBRL } from '@jano/engine';
import { JanoBanner, JanoButton } from '@jano/ui';
import { classeValor, dayLabel } from './agrupar';

export const TRANSFERENCIA = '__transferencia__';

export interface SalvarDetalhe {
  /** Id da categoria, TRANSFERENCIA ou null (sem categoria). */
  escolha: string | null;
  regra: { pattern: string; categoryId: string } | null;
}

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

    @if (!tx().categoryId && !tx().isTransfer && escolha() === null) {
      <jano-banner tone="info" title="Sem categoria.">
        Escolha uma abaixo. Se marcar a regra, o Jano lembra nas próximas
        importações.
      </jano-banner>
    }

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

    @if (podeRegra()) {
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

  protected readonly data = computed(() => dayLabel(this.tx().date));
  protected readonly cor = computed(
    () => classeValor(this.tx()).split(' ').pop() as string,
  );
  protected readonly podeRegra = computed(
    () => !!this.escolha() && this.escolha() !== TRANSFERENCIA,
  );
  protected readonly mudou = computed(() => {
    const t = this.tx();
    const atual = t.isTransfer ? TRANSFERENCIA : t.categoryId;
    return this.escolha() !== atual || (this.podeRegra() && this.criarRegra());
  });

  protected escolher(id: string): void {
    this.escolha.set(id);
  }

  protected salvarClick(): void {
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
