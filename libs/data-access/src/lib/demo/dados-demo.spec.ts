import { gerarDadosDemo } from './dados-demo';

describe('gerarDadosDemo', () => {
  const hoje = new Date(2026, 9, 31, 10);
  const d = gerarDadosDemo(hoje);

  it('cobre o mês atual e os seis anteriores, sem nada no futuro', () => {
    const meses = new Set(d.transactions.map((t) => t.date.slice(0, 7)));
    expect([...meses].sort()).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(d.transactions.every((t) => t.date <= '2026-10-31')).toBe(true);
  });

  it('é sempre igual para o mesmo dia', () => {
    expect(gerarDadosDemo(hoje)).toEqual(d);
  });

  it('toda categoria usada existe, e há o que categorizar', () => {
    const ids = new Set(d.categories.map((c) => c.id));
    const usadas = d.transactions.map((t) => t.categoryId).filter(Boolean);
    expect(usadas.every((id) => ids.has(id as string))).toBe(true);
    expect(d.transactions.some((t) => !t.categoryId && !t.isTransfer)).toBe(
      true,
    );
  });

  it('o cartão deve a soma das compras do mês', () => {
    const doMes = d.transactions
      .filter((t) => t.accountId === 'cartao-de-credito' && t.date >= '2026-10')
      .reduce((s, t) => s - t.amountCents, 0);
    const cartao = d.balances.find((b) => b.kind === 'cartao');
    expect(cartao?.balanceCents).toBe(doMes);
  });
});
