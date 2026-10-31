import { describe, expect, it } from 'vitest';
import type { GoalDoc } from '@jano/data-access';
import { avaliarObjetivo } from './objetivos';

const g = (over: Partial<GoalDoc> = {}): GoalDoc => ({
  id: 'r',
  nome: 'Reserva',
  alvoCents: 3_000_000,
  prazo: '2027-10',
  fonte: 'poupanca',
  guardadoCents: 0,
  criadoEm: '',
  ...over,
});
const base = {
  poupancaCents: 520_000,
  sobraMediaCents: 225_500,
  mesAtual: '2026-10',
};

describe('avaliarObjetivo', () => {
  it('poupança como guardado; por mês até o prazo cabe na sobra média', () => {
    const r = avaliarObjetivo(g(), base);
    expect(r).toMatchObject({
      guardadoCents: 520_000,
      faltaCents: 2_480_000,
      pct: 17,
      meses: 13,
      porMesCents: 190_800,
      situacao: 'no-ritmo',
    });
    // 2.480.000 / 225.500 = 11 meses: de out/26 a ago/27.
    expect(r.chegaEm).toBe('2027-08');
  });

  it('prazo curto: apertado, e quando chega no ritmo atual', () => {
    const r = avaliarObjetivo(g({ prazo: '2027-03' }), base);
    expect(r.situacao).toBe('apertado');
    expect(r.porMesCents).toBe(413_400);
    expect(r.chegaEm).toBe('2027-08');
  });

  it('valor informado, concluído, prazo vencido e sem histórico', () => {
    expect(
      avaliarObjetivo(g({ fonte: 'manual', guardadoCents: 3_000_000 }), base)
        .situacao,
    ).toBe('concluido');
    expect(avaliarObjetivo(g({ prazo: '2026-09' }), base).situacao).toBe(
      'vencido',
    );
    expect(
      avaliarObjetivo(g(), { ...base, sobraMediaCents: null }).situacao,
    ).toBe('sem-base');
  });
});
