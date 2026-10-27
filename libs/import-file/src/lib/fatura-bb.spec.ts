import { describe, expect, it } from 'vitest';
import { inferYear, isFaturaBB, parseFaturaBB } from './fatura-bb';
import { linesFromItems } from './pdf-lines';

const LINES = [
  'OUROCARD VISA Final 1111',
  'Fatura fechada em 26/01/2027',
  'Vencimento',
  '05/02/2027',
  'Lançamentos nesta fatura',
  'Ana Teste (Cartão 1111)',
  'Pagamentos/Créditos',
  '05/01  PGTO. CASH AG. 1  R$ -100,00',
  'Restaurantes',
  '28/12  PADARIA TESTE  SAO LUIS  BR  R$ 20,50',
  'Compras parceladas',
  '26/01  LOJA X PARC 02/05 SAO LUIS  R$ 30,00',
  'Estorno',
  '10/01  ESTORNO LOJA  R$ -5,50',
  'Subtotal  R$ 45,00',
  'Bia Teste (Cartão 2222)',
  'Transporte',
  '02/01  APP RIDE  SAO PAULO  BR  R$ 15,00',
  'Subtotal  R$ 15,00',
  'Total da Fatura  R$ 60,00',
];

describe('parseFaturaBB', () => {
  const r = parseFaturaBB(LINES);

  it('reconhece e lê o cabeçalho', () => {
    expect(isFaturaBB(LINES)).toBe(true);
    expect(r.meta).toEqual({
      closingDate: '2027-01-26',
      dueDate: '2027-02-05',
      cardLast4: '1111',
      totalCents: 6000,
    });
  });

  it('inverte o sinal, deduz o ano e usa o fechamento nas parcelas', () => {
    const byDesc = (s: string) =>
      r.transactions.find((t) => t.description.includes(s))!;
    expect(byDesc('PADARIA')).toMatchObject({
      date: '2026-12-28',
      amountCents: -2050,
      bankCategory: 'Restaurantes',
      holder: '1111',
    });
    expect(byDesc('LOJA X')).toMatchObject({
      date: '2027-01-26',
      installment: { n: 2, total: 5 },
    });
    expect(byDesc('ESTORNO').amountCents).toBe(550);
    expect(byDesc('APP RIDE')).toMatchObject({
      holder: '2222',
      date: '2027-01-02',
    });
  });

  it('marca o pagamento da fatura anterior como transferência e o exclui da soma', () => {
    const pay = r.transactions.find((t) => t.description.startsWith('PGTO'))!;
    expect(pay.isTransfer).toBe(true);
    expect(r.holders.map((h) => h.parsedCents)).toEqual(
      [4500 - 0, 1500].map((v, i) => (i === 0 ? 4500 : v)),
    );
    expect(r.warnings).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('avisa quando a soma não fecha', () => {
    const bad = parseFaturaBB(
      LINES.map((l) => (l === 'Subtotal  R$ 15,00' ? 'Subtotal  R$ 16,00' : l)),
    );
    expect(bad.warnings[0]).toContain('2222');
  });

  it('infere o ano pela data de fechamento', () => {
    expect(inferYear(28, 12, '2027-01-26')).toBe(2026);
    expect(inferYear(5, 1, '2027-01-26')).toBe(2027);
  });
});

describe('linesFromItems', () => {
  it('agrupa por linha e ordena da esquerda para a direita', () => {
    const lines = linesFromItems([
      { str: 'R$ 1,00', x: 100, y: 700, width: 30 },
      { str: 'A', x: 10, y: 700.5, width: 5 },
      { str: 'B', x: 10, y: 680, width: 5 },
    ]);
    expect(lines).toEqual(['A  R$ 1,00', 'B']);
  });
});
