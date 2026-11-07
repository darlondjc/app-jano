import { TestBed } from '@angular/core/testing';
import { GraficoPorDia, type DiaDeGasto } from './grafico-por-dia';

const dias: DiaDeGasto[] = [
  {
    dia: 1,
    rotulo: 'qui, 5 nov',
    cents: 9000,
    maior: { nome: 'Padaria', cents: 9000 },
  },
  { dia: 2, rotulo: 'sex, 6 nov', cents: 0, maior: null },
  {
    dia: 3,
    rotulo: 'sáb, 7 nov',
    cents: 69000,
    maior: { nome: 'Mateus Supermercados', cents: 69000 },
  },
];

function montar() {
  const f = TestBed.createComponent(GraficoPorDia);
  f.componentRef.setInput('dias', dias);
  f.componentRef.setInput('total', 30);
  f.componentRef.setInput('referencia', {
    cents: 41500,
    rotulo: 'R$ 415/dia',
    legenda: 'Pode gastar R$ 415/dia',
  });
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement };
}

describe('GraficoPorDia', () => {
  it('abre no último dia, com o excesso e o maior gasto', () => {
    const { el } = montar();
    const detalhe = el.querySelector('.detalhe')?.textContent ?? '';
    expect(detalhe).toContain('sáb, 7 nov');
    expect(detalhe).toContain('acima de R$ 415/dia');
    expect(detalhe).toContain('Mateus Supermercados');
  });

  it('tocar numa barra mostra aquele dia', () => {
    const { f, el } = montar();
    const barras = el.querySelectorAll<SVGGElement>('g.alvo');
    expect(barras).toHaveLength(3);
    barras[1].dispatchEvent(new Event('click'));
    f.detectChanges();
    expect(el.querySelector('.detalhe')?.textContent).toContain(
      'Nenhum gasto neste dia.',
    );
  });

  it('pinta de âmbar só os dias acima da referência', () => {
    const { el } = montar();
    const cores = [
      ...el.querySelectorAll<SVGRectElement>('g.alvo rect:not(.fundo)'),
    ].map((r) => r.style.fill);
    expect(cores).toEqual([
      'var(--primary)',
      'var(--primary)',
      'var(--warning)',
    ]);
  });
});
