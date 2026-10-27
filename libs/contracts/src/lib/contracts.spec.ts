import { BudgetSchema, MonthSchema, TransactionSchema } from './contracts';

describe('contracts', () => {
  it('rejeita valores com decimais', () => {
    expect(() =>
      BudgetSchema.parse({ categoryId: 'c1', limitCents: 10.5 }),
    ).toThrow();
  });
  it('valida mês AAAA-MM', () => {
    expect(MonthSchema.safeParse('2026-10').success).toBe(true);
    expect(MonthSchema.safeParse('2026-13').success).toBe(false);
  });
  it('aceita uma transação válida', () => {
    expect(
      TransactionSchema.parse({
        id: 't1',
        accountId: 'a1',
        date: '2026-10-22',
        description: 'Atacadão',
        amountCents: -48000,
        categoryId: null,
        isTransfer: false,
      }).amountCents,
    ).toBe(-48000);
  });
});
