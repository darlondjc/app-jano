import {
  bigint, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Dinheiro: sempre centavos inteiros (bigint), negativo para saída.
const cents = (name: string) => bigint(name, { mode: 'number' });
const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();
const userId = () => uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' });

export const accountType = pgEnum('tipo_conta', ['conta', 'cartao']);
export const categoryType = pgEnum('tipo_categoria', ['despesa', 'receita']);
export const importStatus = pgEnum('status_importacao', ['previa', 'confirmada', 'erro', 'cancelada']);

export const users = pgTable('users', {
  id: id(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('nome'),
  onboardingState: text('onboarding_estado').notNull().default('inicio'),
  createdAt: createdAt(),
});

export const accounts = pgTable('accounts', {
  id: id(),
  userId: userId(),
  nickname: text('apelido').notNull(),
  type: accountType('tipo').notNull(),
  bank: text('banco').notNull().default('Banco do Brasil'),
  lastDigits: varchar('ultimos_digitos', { length: 8 }),
  createdAt: createdAt(),
}, (t) => [index('accounts_user_idx').on(t.userId)]);

export const categories = pgTable('categories', {
  id: id(),
  userId: userId(),
  name: text('nome').notNull(),
  color: varchar('cor', { length: 16 }).notNull(),
  icon: text('icone'),
  type: categoryType('tipo').notNull().default('despesa'),
  position: integer('ordem').notNull().default(0),
}, (t) => [uniqueIndex('categories_user_name_uq').on(t.userId, t.name)]);

export const merchants = pgTable('merchants', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = dicionário global
  normalizedName: text('nome_normalizado').notNull(),
  suggestedCategoryName: text('categoria_sugerida'),
}, (t) => [uniqueIndex('merchants_scope_name_uq').on(t.userId, t.normalizedName)]);

export const categoryRules = pgTable('category_rules', {
  id: id(),
  userId: userId(),
  pattern: text('padrao').notNull(), // "contém", comparado com descricao_norm
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  priority: integer('prioridade').notNull().default(0),
}, (t) => [index('rules_user_idx').on(t.userId)]);

export const imports = pgTable('imports', {
  id: id(),
  userId: userId(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  fileKey: text('arquivo'), // chave no storage; apagado após 30 dias
  fileHash: text('hash').notNull(),
  format: text('formato').notNull(),
  status: importStatus('status').notNull().default('previa'),
  total: integer('total').notNull().default(0),
  added: integer('novas').notNull().default(0),
  duplicates: integer('duplicadas').notNull().default(0),
  errors: integer('erros').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  index('imports_user_idx').on(t.userId),
  uniqueIndex('imports_user_hash_uq').on(t.userId, t.accountId, t.fileHash),
]);

export const transactions = pgTable('transactions', {
  id: id(),
  userId: userId(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  importId: uuid('import_id').references(() => imports.id, { onDelete: 'set null' }),
  date: date('data', { mode: 'string' }).notNull(),
  amountCents: cents('amount_cents').notNull(),
  descriptionRaw: text('descricao_original').notNull(),
  descriptionNorm: text('descricao_norm').notNull(),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  categoryIsManual: boolean('categoria_manual').notNull().default(false),
  isTransfer: boolean('is_transfer').notNull().default(false),
  transferPairId: uuid('transfer_pair_id'),
  externalId: text('external_id'), // FITID do OFX
  dedupeKey: text('dedupe_key').notNull(),
  note: text('observacao'),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('tx_dedupe_uq').on(t.userId, t.accountId, t.dedupeKey),
  index('tx_user_date_idx').on(t.userId, t.date),
  index('tx_user_cat_date_idx').on(t.userId, t.categoryId, t.date),
]);

export const transactionSplits = pgTable('transaction_splits', {
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  amountCents: cents('amount_cents').notNull(),
}, (t) => [primaryKey({ columns: [t.transactionId, t.categoryId] })]);

export const budgets = pgTable('budgets', {
  id: id(),
  userId: userId(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  limitCents: cents('limite_cents').notNull(),
  rollover: boolean('rollover').notNull().default(false),
  validFrom: date('vigente_desde', { mode: 'string' }).notNull(),
}, (t) => [
  uniqueIndex('budgets_user_cat_from_uq').on(t.userId, t.categoryId, t.validFrom),
  check('budgets_limit_nonneg', sql`${t.limitCents} >= 0`),
]);

export const budgetOverrides = pgTable('budget_overrides', {
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  month: varchar('mes', { length: 7 }).notNull(), // AAAA-MM
  limitCents: cents('limite_cents').notNull(),
}, (t) => [primaryKey({ columns: [t.budgetId, t.month] })]);

export const recurrences = pgTable('recurrences', {
  id: id(),
  userId: userId(),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  label: text('rotulo').notNull(),
  amountCents: cents('valor_cents').notNull(),
  dayOfMonth: integer('dia').notNull(),
  period: text('periodo').notNull().default('mensal'),
  confidence: integer('confianca').notNull().default(0), // 0–100
  active: boolean('ativa').notNull().default(true),
}, (t) => [index('recurrences_user_idx').on(t.userId)]);

export const scenarios = pgTable('scenarios', {
  id: id(),
  userId: userId(),
  name: text('nome').notNull(),
  deltas: jsonb('deltas').notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
}, (t) => [index('scenarios_user_idx').on(t.userId)]);

export const insights = pgTable('insights', {
  id: id(),
  userId: userId(),
  month: varchar('mes', { length: 7 }).notNull(),
  kind: text('tipo').notNull(),
  payload: jsonb('payload').notNull(),
  dismissedAt: timestamp('dispensado_em', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('insights_user_month_idx').on(t.userId, t.month)]);

export const consents = pgTable('consents', {
  id: id(),
  userId: userId(),
  kind: text('tipo').notNull(),
  textVersion: text('versao_texto').notNull(),
  acceptedAt: timestamp('aceito_em', { withTimezone: true }).notNull().defaultNow(),
});

// Sem dados financeiros: só ação, entidade e quando.
export const auditLog = pgTable('audit_log', {
  id: id(),
  userId: uuid('user_id'),
  action: text('acao').notNull(),
  entity: text('entidade'),
  createdAt: createdAt(),
});
