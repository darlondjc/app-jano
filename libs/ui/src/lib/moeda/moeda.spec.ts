import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JanoMoeda, textoDeMoeda } from './moeda';

@Component({
  imports: [JanoMoeda],
  template: `<input
      id="a"
      janoMoeda
      [value]="inicial"
      (input)="lido.set($any($event.target).value)"
    /><input id="b" janoMoeda [moedaNegativa]="true" />`,
})
class Host {
  inicial = '1400,00';
  readonly lido = signal('');
}

function digitar(el: HTMLInputElement, valor: string) {
  el.value = valor;
  el.dispatchEvent(new Event('input'));
}

describe('JanoMoeda', () => {
  it('formata centavos com milhar', () => {
    expect(textoDeMoeda(123456)).toBe('1.234,56');
    expect(textoDeMoeda(5)).toBe('0,05');
    expect(textoDeMoeda(-100000)).toBe('-1.000,00');
  });

  it('dígitos entram pela direita e letras ou vírgulas a mais somem', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const a = f.nativeElement.querySelector('#a') as HTMLInputElement;
    // O valor inicial ganha o formato da máscara.
    expect(a.value).toBe('1.400,00');
    digitar(a, '1');
    expect(a.value).toBe('0,01');
    digitar(a, '0,0123');
    expect(a.value).toBe('1,23');
    digitar(a, '1,23a4,,5');
    expect(a.value).toBe('123,45');
    digitar(a, '1.234,567');
    expect(a.value).toBe('12.345,67');
    // A tela, ouvindo (input), já recebe o texto formatado.
    expect(f.componentInstance.lido()).toBe('12.345,67');
    digitar(a, '');
    expect(a.value).toBe('');
  });

  it('negativo só onde é permitido', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const a = f.nativeElement.querySelector('#a') as HTMLInputElement;
    const b = f.nativeElement.querySelector('#b') as HTMLInputElement;
    digitar(a, '-500');
    expect(a.value).toBe('5,00');
    digitar(b, '-500');
    expect(b.value).toBe('-5,00');
  });
});
