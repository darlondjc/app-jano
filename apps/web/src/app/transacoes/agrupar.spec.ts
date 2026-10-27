import type { TransactionDoc } from '@jano/data-access';
import {
  agruparPorDia,
  dayLabel,
  gastosDoMes,
  mesAnterior,
  mesSeguinte,
  rotuloMes,
} from './agrupar';

const tx = (
  id: string,
  date: string,
  amountCents: number,
  extra: Partial<TransactionDoc> = {},
): TransactionDoc => ({
  id,
  accountId: 'cc',
  date,
  amountCents,
  description: id,
  descriptionNorm: id,
  dedupeKey: id,
  categoryId: null,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
  ...extra,
});

describe('agrupar', () => {
  it('rotula o dia da semana corretamente', () => {
    expect(dayLabel('2026-10-22')).toBe('Quinta, 22 de outubro');
    expect(dayLabel('2026-10-27')).toBe('Terça, 27 de outubro');
  });
  it('agrupa do mais recente ao mais antigo', () => {
    const g = agruparPorDia([
      tx('a', '2026-10-05', -1),
      tx('b', '2026-10-22', -2),
      tx('c', '2026-10-22', -3),
    ]);
    expect(g.map((x) => x.date)).toEqual(['2026-10-22', '2026-10-05']);
    expect(g[0].items).toHaveLength(2);
  });
  it('gastos ignoram receitas e transferências', () => {
    const total = gastosDoMes([
      tx('a', '2026-10-05', 635000),
      tx('b', '2026-10-22', -48000),
      tx('c', '2026-10-25', -50000, { isTransfer: true }),
      tx('d', '2026-10-21', -4200),
    ]);
    expect(total).toBe(52200);
  });
  it('navega entre meses virando o ano', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesSeguinte('2026-12')).toBe('2027-01');
    expect(rotuloMes('2026-10')).toBe('Outubro 2026');
  });
});
