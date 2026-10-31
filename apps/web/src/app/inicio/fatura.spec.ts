import { describe, expect, it } from 'vitest';
import { gerarDadosDemo } from '@jano/data-access';
import { faturaDoCartao } from './fatura';

const dados = gerarDadosDemo(new Date(2026, 9, 31, 10));
const cartoes = new Set(['cartao-de-credito']);

describe('faturaDoCartao', () => {
  it('em aberto com vencimento e a próxima com parcelas e assinaturas', () => {
    const f = faturaDoCartao({
      faturaCents: 309_511,
      txs: dados.transactions,
      cartoes,
      hoje: '2026-10-31',
    });
    expect(f).toMatchObject({
      abertaCents: 309_511,
      vence: '2026-11-07',
      parcelasCents: 34_990,
      nParcelas: 1,
    });
    // Netflix e Spotify todo mês (o YouTube é novo: ainda não é recorrente).
    expect(f?.assinaturasCents).toBe(5_590 + 2_190);
    expect(f?.proximaCents).toBe(34_990 + 5_590 + 2_190);
  });

  it('sem cartão, nada', () => {
    expect(
      faturaDoCartao({
        faturaCents: 0,
        txs: dados.transactions,
        cartoes: new Set(),
        hoje: '2026-10-31',
      }),
    ).toBeNull();
  });

  it('sem pagamento anterior, sem vencimento previsto', () => {
    const f = faturaDoCartao({
      faturaCents: 10_000,
      txs: dados.transactions.filter((t) => !t.isTransfer),
      cartoes,
      hoje: '2026-10-31',
    });
    expect(f?.vence).toBeNull();
  });
});
