import { TestBed } from '@angular/core/testing';
import { GraficoPorDia, type DiaDeGasto } from './grafico-por-dia';

const dias: DiaDeGasto[] = [
  {
    dia: 1,
    rotulo: 'qui, 5 nov',
    cents: 9000,
    maior: { nome: 'Padaria', cents: 9000 },
  },
  { dia: 2, diaDoMes: 6, rotulo: 'sex, 6 nov', cents: 0, maior: null },
  {
    dia: 3,
    diaDoMes: 7,
    rotulo: 'sáb, 7 nov',
    cents: 69000,
    maior: { nome: 'Mateus Supermercados', cents: 69000 },
  },
];

function montar() {
  const f = TestBed.createComponent(GraficoPorDia);
  f.componentRef.setInput('dias', dias);
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

  it('eixo de baixo com o dia do mês', () => {
    const { el } = montar();
    const rotulos = [...el.querySelectorAll('g.alvo text')].map((t) =>
      t.textContent?.trim(),
    );
    expect(rotulos).toContain('7');
  });

  it('zoom nos dias típicos: o dia muito caro aparece cortado, com o valor', () => {
    const f = TestBed.createComponent(GraficoPorDia);
    const dia = (n: number, cents: number): DiaDeGasto => ({
      dia: n,
      diaDoMes: n,
      rotulo: `dia ${n}`,
      cents,
      maior: null,
    });
    f.componentRef.setInput('dias', [
      dia(1, 15000),
      dia(2, 9000),
      dia(3, 20000),
      dia(4, 350000),
      dia(5, 12000),
    ]);
    f.componentRef.setInput('referencia', {
      cents: 30300,
      rotulo: 'R$ 303/dia',
      legenda: 'Pode gastar R$ 303/dia',
    });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    // Teto em R$ 1 mil (perto de 2× a referência), não nos R$ 3,5 mil.
    const eixo = [...el.querySelectorAll('.grafico > svg text')].map((t) =>
      t.textContent?.trim(),
    );
    expect(eixo).toContain('R$ 1 mil');
    expect(el.querySelector('.valor-corte')?.textContent?.trim()).toBe(
      '3,5 mil',
    );
  });
});
