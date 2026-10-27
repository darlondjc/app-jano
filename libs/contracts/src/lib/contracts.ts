import { z } from 'zod';

/** Dinheiro: centavos inteiros, negativo para saída. */
export const CentsSchema = z.number().int();

export const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM');

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  date: z.string().date(),
  description: z.string(),
  amountCents: CentsSchema,
  categoryId: z.string().nullable(),
  isTransfer: z.boolean(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const BudgetSchema = z.object({
  categoryId: z.string(),
  limitCents: CentsSchema.nonnegative(),
  rollover: z.boolean().default(false),
});
export type Budget = z.infer<typeof BudgetSchema>;
