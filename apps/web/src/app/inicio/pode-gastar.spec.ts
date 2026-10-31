import { describe, expect, it } from 'vitest';
import type { HistTx } from '@jano/engine';
import { podeGastar } from './pode-gastar';

const tx = (date: string, reais: number, descriptionNorm: string): HistTx => ({
  date,
  amountCents: Math.round(reais * 100),
  categoryId: null,
  descriptionNorm,
  isTransfer: false,
});

/** Salário dia 5, aluguel dia 24 e escola dia 10, de julho a outubro. */
const historico = ['07', '08', '09', '10'].flatMap((m) => [
  tx(`2026-${m}-05`, 9850, 'SALARIO'),
  tx(`2026-${m}-24`, -3460, 'ALUGUEL'),
  tx(`2026-${m}-10`, -2615, 'ESCOLA'),
]);

describe('podeGastar', () => {
  it('desconta fatura e as contas até o salário e divide pelos dias', () => {
    const r = podeGastar({
      saldoCents: 1_250_000,
      faturaCents: 321_400,
      txs: historico,
      hoje: '2026-10-31',
    });
    // Salário em 5/11; nenhuma conta fixa vence antes (escola é dia 10, aluguel 24).
    expect(r).toMatchObject({
      salario: '2026-11-05',
      dias: 5,
      contasCents: 0,
      faturaCents: 321_400,
      livreCents: 928_600,
      porDiaCents: 185_700,
    });
  });

  it('conta fixa antes do salário e ainda não paga entra no desconto', () => {
    const r = podeGastar({
      saldoCents: 800_000,
      faturaCents: 0,
      txs: historico.filter((t) => !(t.date === '2026-10-24')),
      hoje: '2026-10-20',
    });
    // Aluguel de 24/10 ainda não veio; salário só em 5/11.
    expect(r?.contasCents).toBe(346_000);
    expect(r?.livreCents).toBe(454_000);
  });

  it('salário deste mês já recebido: o próximo é no mês que vem', () => {
    const r = podeGastar({
      saldoCents: 100_000,
      faturaCents: 0,
      txs: historico,
      hoje: '2026-10-06',
    });
    expect(r?.salario).toBe('2026-11-05');
  });

  it('quando as contas passam do saldo, não sobra nada por dia', () => {
    const r = podeGastar({
      saldoCents: 100_000,
      faturaCents: 300_000,
      txs: historico,
      hoje: '2026-10-31',
    });
    expect(r?.livreCents).toBe(-200_000);
    expect(r?.porDiaCents).toBe(0);
  });

  it('sem entrada recorrente, não há previsão', () => {
    expect(
      podeGastar({
        saldoCents: 100_000,
        faturaCents: 0,
        txs: historico.filter((t) => t.amountCents < 0),
        hoje: '2026-10-31',
      }),
    ).toBeNull();
  });
});
