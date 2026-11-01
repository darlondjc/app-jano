import { afterEach, describe, expect, it } from 'vitest';
import {
  CALENDARIO_DO_MES,
  calendarioPeloSalario,
  definirCalendario,
  diaNoPeriodo,
  diasNoPeriodo,
  diasRestantesNoPeriodo,
  mesesDoPeriodo,
  periodoDe,
  ritmoDoPeriodo,
  rotuloDoPeriodo,
} from './periodo';
import { categoriesAboveNormal } from './insights';

afterEach(() => definirCalendario(null));

describe('calendário pelo salário', () => {
  // Salário no dia 5; em setembro adiantou para o dia 3 (dia 5 caiu num domingo, por exemplo).
  const c = calendarioPeloSalario(
    ['2026-08-05', '2026-09-03', '2026-10-05'],
    5,
  );

  it('o período vai da chegada do salário à véspera da próxima', () => {
    expect(c.inicio('2026-09')).toBe('2026-09-03');
    expect(c.fim('2026-09')).toBe('2026-10-04');
    expect(c.inicio('2026-10')).toBe('2026-10-05');
    // Novembro ainda não chegou: vale o dia previsto.
    expect(c.fim('2026-10')).toBe('2026-11-04');
  });

  it('1º de novembro ainda é do período de outubro', () => {
    expect(c.chave('2026-11-01')).toBe('2026-10');
    expect(c.chave('2026-11-05')).toBe('2026-11');
    expect(c.chave('2026-10-04')).toBe('2026-09');
    expect(c.chave('2026-09-03')).toBe('2026-09');
    expect(c.chave('2026-09-02')).toBe('2026-08');
  });

  it('salário perto da virada que adianta para o mês anterior', () => {
    const v = calendarioPeloSalario(['2026-10-30'], 1);
    // Previsto para 1/nov, caiu em 30/out: o período de novembro começa em 30/out.
    expect(v.chave('2026-10-30')).toBe('2026-11');
    expect(v.chave('2026-10-29')).toBe('2026-10');
    expect(v.inicio('2026-11')).toBe('2026-10-30');
  });

  it('dia, ritmo, rótulo e meses do período', () => {
    definirCalendario(c);
    expect(periodoDe('2026-11-01')).toBe('2026-10');
    expect(diasNoPeriodo('2026-10')).toBe(31);
    expect(diaNoPeriodo('2026-11-01')).toBe(28);
    expect(ritmoDoPeriodo('2026-10', '2026-11-01')).toBeCloseTo(28 / 31);
    expect(diasRestantesNoPeriodo('2026-10', '2026-11-01')).toBe(3);
    expect(rotuloDoPeriodo('2026-10')).toBe('5/out – 4/nov');
    expect(mesesDoPeriodo('2026-10')).toEqual(['2026-10', '2026-11']);
  });

  it('as análises passam a comparar períodos', () => {
    definirCalendario(c);
    const tx = (date: string, reais: number) => ({
      date,
      amountCents: -reais * 100,
      categoryId: 'mercado',
      descriptionNorm: 'M',
      isTransfer: false,
    });
    // Gasto de 2/out é do período de setembro; no mês do calendário seria de outubro.
    const txs = [
      tx('2026-08-10', 100),
      tx('2026-09-10', 100),
      tx('2026-10-02', 100),
      tx('2026-10-10', 400),
    ];
    expect(categoriesAboveNormal(txs, '2026-10')[0]?.spentCents).toBe(40000);
  });
});

describe('sem salário conhecido', () => {
  it('o período é o mês do calendário', () => {
    expect(periodoDe('2026-11-01')).toBe('2026-11');
    expect(CALENDARIO_DO_MES.fim('2026-02')).toBe('2026-02-28');
    expect(diasNoPeriodo('2026-11')).toBe(30);
  });
});
