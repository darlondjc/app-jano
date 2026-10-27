import { TestBed } from '@angular/core/testing';
import { JanoKpiCard } from './kpi-card';

function text(valueCents: number): string {
  const f = TestBed.createComponent(JanoKpiCard);
  f.componentRef.setInput('label', 'Saldo');
  f.componentRef.setInput('valueCents', valueCents);
  f.detectChanges();
  return (f.nativeElement.querySelector('.j-kpi__value').textContent as string)
    .replace(/\s+/g, ' ')
    .trim();
}

describe('JanoKpiCard', () => {
  it('separa reais e centavos', () =>
    expect(text(483217)).toBe('R$ 4.832,17'));
  it('mostra sinal de menos', () => expect(text(-5)).toBe('−R$ 0,05'));
});
