import {
  detectRecurrences,
  proximaCobranca,
  type HistTx,
  type RecurringSeries,
} from '@jano/engine';

export interface TxRec extends HistTx {
  description: string;
}

export interface LinhaRecorrencia {
  nome: string;
  categoryId: string | null;
  cents: number;
  previousCents: number;
  /** Variação do último valor sobre o anterior, em %, com uma casa. */
  pct: number;
  day: number;
  meses: number;
  tipo: 'gasto' | 'entrada';
  /** AAAA-MM-DD */
  proxima: string;
  reajustada: boolean;
  nova: boolean;
}

function diasAtras(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Cobranças e entradas que se repetem todo mês, da próxima para a mais distante. */
export function montarRecorrencias(
  txs: TxRec[],
  hoje: string,
): LinhaRecorrencia[] {
  const ultimo = new Map<string, TxRec>();
  for (const t of [...txs].sort((a, b) => a.date.localeCompare(b.date)))
    ultimo.set(t.descriptionNorm, t);

  const monta = (
    series: RecurringSeries[],
    tipo: LinhaRecorrencia['tipo'],
  ): LinhaRecorrencia[] =>
    series.map((s) => {
      const t = ultimo.get(s.description);
      const pct =
        s.previousCents > 0
          ? Math.round((s.amountCents / s.previousCents - 1) * 1000) / 10
          : 0;
      return {
        nome: t?.description ?? s.description,
        categoryId: t?.categoryId ?? null,
        cents: s.amountCents,
        previousCents: s.previousCents,
        pct,
        day: s.day,
        meses: s.months,
        tipo,
        proxima: proximaCobranca(s.day, hoje),
        reajustada: pct > 3,
        nova: s.firstSeen >= diasAtras(hoje, 75),
      };
    });

  return [
    ...monta(detectRecurrences(txs, 'gasto'), 'gasto'),
    ...monta(detectRecurrences(txs, 'entrada'), 'entrada'),
  ].sort((a, b) => a.proxima.localeCompare(b.proxima) || b.cents - a.cents);
}

/** Total mensal das recorrências de um tipo. */
export function totalMensal(
  linhas: LinhaRecorrencia[],
  tipo: LinhaRecorrencia['tipo'],
): number {
  return linhas.filter((l) => l.tipo === tipo).reduce((s, l) => s + l.cents, 0);
}
