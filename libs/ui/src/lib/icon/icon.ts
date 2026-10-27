import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS, iconInnerSvg } from './icons';

/** Ícone de categoria. Decorativo por padrão (aria-hidden); passe `label` para anunciá-lo. */
@Component({
  selector: 'jano-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    [attr.width]="size()"
    [attr.height]="size()"
    [attr.aria-hidden]="label() ? null : 'true'"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label() || null"
    [innerHTML]="inner()"
  ></svg>`,
})
export class JanoIcon {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string | null | undefined>();
  readonly size = input(20);
  readonly label = input<string>();

  // Conteúdo gerado só a partir do registro estático de ícones, então é seguro confiar nele.
  protected readonly inner = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      iconInnerSvg(
        this.name() && ICONS[this.name()!] ? this.name()! : 'etiqueta',
      ),
    ),
  );
}
