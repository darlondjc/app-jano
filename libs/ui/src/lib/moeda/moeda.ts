import {
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

/** Até R$ 99 bilhões: o bastante para qualquer valor do app. */
const MAX_DIGITOS = 13;

/** Centavos no formato do campo: 123456 → "1.234,56" (sem "R$", que fica no prefixo). */
export function textoDeMoeda(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${reais},${centavos}`;
}

/**
 * Máscara de moeda, como nos apps de banco: só aceita números, e cada dígito entra pela
 * direita (1 → 0,01; 12 → 0,12; 1234 → 12,34; 123456 → 1.234,56). Não tem como digitar
 * vírgula a mais, letra ou ponto no lugar errado. O valor do campo continua texto no formato
 * que `parseAmountToCents` lê. Com `moedaNegativa`, o sinal de menos alterna o sinal.
 *
 * Uso: <input janoMoeda [value]="..." />
 */
@Directive({
  selector: 'input[janoMoeda]',
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    // Antes dos (input) da tela: quem lê o valor já recebe o texto formatado.
    '(input)': 'formatar()',
  },
})
export class JanoMoeda {
  /** Aceita valor negativo (ex.: saldo); o "-" alterna o sinal. */
  readonly moedaNegativa = input(false);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    // O valor inicial vem da tela ("1400,00"): já mostra no formato da máscara.
    afterNextRender(() => {
      if (this.el.nativeElement.value) this.formatar();
    });
  }

  formatar(): void {
    const campo = this.el.nativeElement;
    const bruto = campo.value;
    const negativo = this.moedaNegativa() && bruto.includes('-');
    const digitos = bruto
      .replace(/\D/g, '')
      .replace(/^0+/, '')
      .slice(0, MAX_DIGITOS);
    const texto = digitos
      ? textoDeMoeda(Number(digitos) * (negativo ? -1 : 1))
      : negativo
        ? '-'
        : '';
    if (texto !== bruto) campo.value = texto;
    // Cursor no fim: os dígitos entram sempre pela direita.
    const fim = campo.value.length;
    try {
      campo.setSelectionRange(fim, fim);
    } catch {
      /* alguns tipos de campo não aceitam seleção */
    }
  }
}
