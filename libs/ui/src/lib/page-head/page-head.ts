import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Título da página com as ações dela (botões projetados). Gruda logo abaixo do topo fixo do
 * app; ao rolar, vira uma barra compacta com fundo, para o título e os botões seguirem à mão.
 * A altura não muda entre os dois estados, então a página não pula.
 *
 * O subtítulo (`j-sub`) fica fora, logo depois do componente: ele rola com a página.
 */
@Component({
  selector: 'jano-page-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compacto]': 'compacto()' },
  styles: `
    :host {
      position: sticky;
      top: var(--jano-topo, 0px);
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 56px;
      /* Fundo de ponta a ponta sem mudar a largura do conteúdo. */
      box-shadow: 0 0 0 100vmax transparent;
      clip-path: inset(0 -100vmax);
      transition:
        background-color 150ms ease,
        box-shadow 150ms ease;
    }
    :host(.compacto) {
      background: var(--surface);
      box-shadow:
        0 0 0 100vmax var(--surface),
        0 1px 0 100vmax var(--border);
    }
    h1 {
      flex: 1;
      min-width: 0;
      margin: 0;
      font: 600 28px/36px var(--font-sans);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: font-size 150ms ease;
    }
    :host(.compacto) h1 {
      font-size: 18px;
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .acoes:empty {
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      h1 {
        transition: none;
      }
    }
  `,
  template: `
    <h1>{{ titulo() }}</h1>
    <div class="acoes"><ng-content /></div>
  `,
})
export class JanoPageHead {
  readonly titulo = input.required<string>();
  protected readonly compacto = signal(false);
  private readonly el = inject(ElementRef<HTMLElement>);

  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected medir(): void {
    const host = this.el.nativeElement as HTMLElement;
    const topo = parseFloat(getComputedStyle(host).top) || 0;
    this.compacto.set(
      window.scrollY > 0 && host.getBoundingClientRect().top <= topo + 1,
    );
  }
}
