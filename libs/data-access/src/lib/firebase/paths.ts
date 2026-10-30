/** Caminhos do Firestore. Tudo do usuário fica sob users/{uid}: isolamento por regra. */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  accounts: (uid: string) => `users/${uid}/accounts`,
  categories: (uid: string) => `users/${uid}/categories`,
  rules: (uid: string) => `users/${uid}/rules`,
  imports: (uid: string) => `users/${uid}/imports`,
  /** id do documento = dedupeKey; reimportar o mesmo arquivo sobrescreve, nunca duplica. */
  transactions: (uid: string) => `users/${uid}/transactions`,
  budgets: (uid: string) => `users/${uid}/budgets`,
  recurrences: (uid: string) => `users/${uid}/recurrences`,
  scenarios: (uid: string) => `users/${uid}/scenarios`,
  insights: (uid: string) => `users/${uid}/insights`,
  /** Saldo de cada conta no banco, gravado pela sincronização Open Finance (tools/pluggy-sync). */
  balances: (uid: string) => `users/${uid}/balances`,
} as const;
