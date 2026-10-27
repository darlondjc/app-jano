import type { KeyedTransaction } from './dedupe';

export interface ImportPlan {
  /** Ainda não gravadas. */
  fresh: KeyedTransaction[];
  /** Já existem (mesma chave); não serão regravadas, então edições manuais ficam. */
  duplicates: KeyedTransaction[];
  /** Menor e maior data do arquivo, para buscar só esse período no banco. */
  from: string | null;
  to: string | null;
}

export function dateRange(rows: { date: string }[]): {
  from: string | null;
  to: string | null;
} {
  if (!rows.length) return { from: null, to: null };
  const dates = rows.map((r) => r.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

/** Separa o que é novo do que já foi importado. `existingKeys` vem do período do arquivo. */
export function planImport(
  rows: KeyedTransaction[],
  existingKeys: ReadonlySet<string>,
): ImportPlan {
  const fresh: KeyedTransaction[] = [];
  const duplicates: KeyedTransaction[] = [];
  for (const row of rows)
    (existingKeys.has(row.dedupeKey) ? duplicates : fresh).push(row);
  return { fresh, duplicates, ...dateRange(rows) };
}
