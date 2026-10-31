import type { TransactionDoc } from '@jano/data-access';
import { pendentesDeTransferencia } from './transferencias';

const tx = (
  id: string,
  descriptionNorm: string,
  extra: Partial<TransactionDoc> = {},
): TransactionDoc => ({
  id,
  accountId: 'cc',
  date: '2026-10-07',
  amountCents: -300000,
  description: descriptionNorm,
  descriptionNorm,
  dedupeKey: id,
  categoryId: null,
  categoryIsManual: false,
  isTransfer: false,
  importId: null,
  ...extra,
});

describe('pendentesDeTransferencia', () => {
  it('só marca o que parece transferência e está sem categoria', () => {
    expect(
      pendentesDeTransferencia([
        tx('a', 'PAGTO CARTAO CREDITO'),
        tx('b', 'PAGTO CARTAO CREDITO', { categoryId: 'moradia' }),
        tx('c', 'PAGTO CARTAO CREDITO', { categoryIsManual: true }),
        tx('d', 'PAGTO CARTAO CREDITO', { isTransfer: true }),
        tx('e', 'PADARIA'),
      ]),
    ).toEqual(['a']);
  });
});
