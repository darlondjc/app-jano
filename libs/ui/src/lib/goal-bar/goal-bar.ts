import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { estadoDaMeta, formatBRL, type ContaDoMes } from '@jano/engine';

/**
 * Barra de meta mensal: gasto × limite, marcador de ritmo e frase de estado (cor nunca sozinha).
 * Categoria de contas do mês (`conta`) não tem ritmo: a frase diz se já foram pagas.
 */
@Component({
  selector: 'jano-goal-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="(plain() ? '' : 'j-card ') + 'j-goal j-goal--' + modifier()">
      <div class="j-goal__head">
        <span>{{ name() }}</span
        ><span class="j-goal__pct j-num">{{ percent() }}%</span>
      </div>
      <div
        class="j-goal__track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent()"
        [attr.aria-label]="name()"
      >
        <div class="j-goal__fill" [style.width.%]="fill()"></div>
        @if (comRitmo()) {
          <div
            class="j-goal__pace"
            [style.left.%]="paceLeft()"
            [style.transform]="paceShift()"
          ></div>
        }
      </div>
      <div class="j-goal__meta">
        <span>{{ money(spentCents()) }} de {{ money(limitCents()) }}</span>
        @if (comRitmo() && ritmoNoTexto()) {
          <span>Ritmo ideal: {{ paceLeft() }}%</span>
        }
      </div>
      <div class="j-goal__state">{{ message() }}</div>
    </div>
  `,
})
export class JanoGoalBar {
  /** Sem moldura de cartão, para usar dentro de outro cartão. */
  readonly plain = input(false);
  readonly name = input.required<string>();
  readonly spentCents = input.required<number>();
  readonly limitCents = input.required<number>();
  /** Fração do mês decorrida (0–1). Omitir em meses encerrados. */
  readonly pace = input<number>();
  /** Dias que faltam no mês, para a mensagem de atenção. */
  readonly daysLeft = input<number>();
  /** "Ritmo ideal: N%" em cada barra; desligue quando a tela já mostra o ritmo uma vez. */
  readonly ritmoNoTexto = input(true);
  /** Contas do mês (aluguel, escola): esperado, pago e o que falta. */
  readonly conta = input<ContaDoMes>();

  protected readonly comRitmo = computed(
    () => this.pace() !== undefined && !this.conta(),
  );
  private readonly estado = computed(() =>
    estadoDaMeta({
      spentCents: this.spentCents(),
      limitCents: this.limitCents(),
      pace: this.pace(),
      conta: this.conta(),
    }),
  );
  /** Gasto bem à frente do ritmo do mês, ainda abaixo de 80% da meta. */
  protected readonly adiantada = computed(() => this.estado().adiantada);
  protected readonly status = computed(() => this.estado().status);
  protected readonly modifier = computed(
    () => ({ ok: 'ok', warning: 'warn', over: 'over' })[this.status()],
  );
  protected readonly percent = computed(() => {
    const limit = this.limitCents();
    return limit > 0
      ? Math.round((this.spentCents() / limit) * 100)
      : this.spentCents() > 0
        ? 100
        : 0;
  });
  protected readonly fill = computed(() => Math.min(this.percent(), 100));
  protected readonly paceLeft = computed(() =>
    Math.round((this.pace() ?? 0) * 100),
  );
  /** Recua o marcador na mesma proporção: em 100% ele fica dentro da barra, não pendurado fora. */
  protected readonly paceShift = computed(
    () => `translateX(-${this.paceLeft()}%)`,
  );

  protected readonly message = computed(() => {
    const left = this.limitCents() - this.spentCents();
    const conta = this.conta();
    if (conta) {
      if (left < 0) return `Passou ${formatBRL(-left)} da meta.`;
      if (!conta.faltaCents)
        return `Contas do mês pagas. Sobram ${formatBRL(left)}.`;
      const depois = left - conta.faltaCents;
      return depois < 0
        ? `Ainda deve sair cerca de ${formatBRL(conta.faltaCents)}; com isso passa ${formatBRL(-depois)} da meta.`
        : `Ainda deve sair cerca de ${formatBRL(conta.faltaCents)}.`;
    }
    if (this.adiantada()) {
      const dias = (this.daysLeft() ?? 0) + 1;
      return `Acima do ritmo: para fechar na meta, até ${formatBRL(Math.floor(left / dias))} por dia.`;
    }
    switch (this.status()) {
      case 'ok':
        return `No ritmo. Sobram ${formatBRL(left)}.`;
      case 'warning': {
        if (left <= 0) return 'No limite da meta: não sobra nada.';
        const d = this.daysLeft();
        if (d === undefined) return `Atenção: restam ${formatBRL(left)}.`;
        if (d === 0)
          return `Atenção: último dia do mês e restam ${formatBRL(left)}.`;
        return d === 1
          ? `Atenção: resta 1 dia e ${formatBRL(left)}.`
          : `Atenção: restam ${d} dias e ${formatBRL(left)}.`;
      }
      case 'over':
        return `Passou ${formatBRL(-left)} da meta.`;
    }
  });

  protected money = formatBRL;
}
