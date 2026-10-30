import type { BalanceDoc } from '@jano/data-access';
import { saldoAtual } from './saldo';

function b(over: Partial<BalanceDoc>): BalanceDoc {
  return {
    id: 'x',
    name: 'BB',
    kind: 'conta',
    detail: 'corrente',
    accountId: null,
    balanceCents: 0,
    bankUpdatedAt: null,
    syncedAt: '2026-10-30T09:00:00.000Z',
    ...over,
  };
}

describe('saldoAtual', () => {
  it('sem sincronização não há saldo', () => {
    expect(saldoAtual([])).toBeNull();
    expect(
      saldoAtual([b({ kind: 'cartao', detail: 'cartão de crédito' })]),
    ).toBeNull();
  });

  it('soma corrente e poupança e deixa o cartão de fora', () => {
    expect(
      saldoAtual([
        b({ id: 'cc', balanceCents: 120000 }),
        b({ id: 'pp', detail: 'poupança', balanceCents: 30017 }),
        b({
          id: 'ct',
          kind: 'cartao',
          detail: 'cartão de crédito',
          balanceCents: 99999,
        }),
      ]),
    ).toEqual({
      cents: 150017,
      legenda: 'Conta corrente e poupança',
      atualizadoEm: '2026-10-30T09:00:00.000Z',
    });
  });

  it('usa a atualização mais recente e prefere a data do banco', () => {
    const s = saldoAtual([
      b({ id: 'cc', bankUpdatedAt: '2026-10-29T23:00:00.000Z' }),
      b({ id: 'pp', detail: 'poupança', syncedAt: '2026-10-28T09:00:00.000Z' }),
    ]);
    expect(s?.atualizadoEm).toBe('2026-10-29T23:00:00.000Z');
  });

  it('legenda de uma conta só', () => {
    expect(saldoAtual([b({})])?.legenda).toBe('Conta corrente');
  });
});
