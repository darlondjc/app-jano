import { describe, expect, it } from 'vitest';
import { contasDoMes } from './contas-mensais';
import type { HistTx } from './insights';

const tx = (
  date: string,
  reais: number,
  categoryId: string,
  descriptionNorm: string,
): HistTx => ({
  date,
  amountCents: -Math.round(reais * 100),
  categoryId,
  descriptionNorm,
  isTransfer: false,
});

const historico: HistTx[] = [
  // Escola: um Pix por mês, sempre igual.
  tx('2026-08-10', 1450, 'educacao', 'PIX ENVIADO 10/08 08:30 ESCOLA'),
  tx('2026-09-10', 1450, 'educacao', 'PIX ENVIADO 10/09 08:31 ESCOLA'),
  // Moradia: luz (varia) e aluguel.
  tx('2026-08-15', 280, 'moradia', 'ENERGIA ELETRICA'),
  tx('2026-08-24', 2400, 'moradia', 'PIX ENVIADO 24/08 IMOBILIARIA'),
  tx('2026-09-15', 300, 'moradia', 'ENERGIA ELETRICA'),
  tx('2026-09-24', 2400, 'moradia', 'PIX ENVIADO 24/09 IMOBILIARIA'),
  // Restaurantes: lugares diferentes a cada mês.
  tx('2026-08-03', 80, 'restaurantes', 'IFOOD'),
  tx('2026-09-05', 60, 'restaurantes', 'PADARIA'),
];

describe('contasDoMes', () => {
  it('escola paga no mês: falta zero', () => {
    const c = contasDoMes(
      [
        ...historico,
        tx('2026-10-10', 1450, 'educacao', 'PIX ENVIADO 10/10 08:30 ESCOLA'),
      ],
      '2026-10',
    );
    expect(c.get('educacao')).toEqual({
      esperadoCents: 145000,
      pagoCents: 145000,
      faltaCents: 0,
    });
  });

  it('moradia com só a luz paga: falta o aluguel', () => {
    const c = contasDoMes(
      [...historico, tx('2026-10-15', 310, 'moradia', 'ENERGIA ELETRICA')],
      '2026-10',
    );
    expect(c.get('moradia')?.faltaCents).toBe(269000 - 31000);
  });

  it('gasto variado não é conta do mês', () => {
    expect(contasDoMes(historico, '2026-10').has('restaurantes')).toBe(false);
  });

  it('lançamento novo na categoria tira ela das contas do mês', () => {
    const c = contasDoMes(
      [...historico, tx('2026-10-02', 90, 'moradia', 'LOJA DE TINTAS')],
      '2026-10',
    );
    expect(c.has('moradia')).toBe(false);
  });
});

it('duas idas ao mesmo lugar no mês não são conta', () => {
  const m = (d: string, v: number) => tx(d, v, 'mercado', 'MERCADO');
  const c = contasDoMes(
    [
      m('2026-08-03', 100),
      m('2026-08-15', 110),
      m('2026-09-03', 100),
      m('2026-09-15', 105),
    ],
    '2026-10',
  );
  expect(c.has('mercado')).toBe(false);
});
