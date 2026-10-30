import {
  categoriesAboveNormal,
  detectRecurrences,
  newSubscriptions,
  repricedRecurrences,
  unusualTransactions,
  type HistTx,
} from '@jano/engine';

export interface Alerta {
  tom: 'warn' | 'info';
  titulo: string;
  texto: string;
}

export interface EntradaAlertas {
  /** Mês atual e os anteriores (histórico para comparar). */
  txs: HistTx[];
  /** AAAA-MM */
  month: string;
  /** AAAA-MM-DD */
  today: string;
  budgets: { categoryId: string; limitCents: number }[];
  spentByCategory: Record<string, number>;
  daysLeft: number;
  assinaturasId: string | null;
  nomeCategoria: (id: string) => string;
  moeda: (cents: number) => string;
}

const MAX = 4;

/** "Para ver hoje": o que merece atenção, do mais urgente ao menos, no máximo quatro. */
export function montarAlertas(e: EntradaAlertas): Alerta[] {
  const out: Alerta[] = [];

  const metas = e.budgets
    .map((b) => ({
      ...b,
      spent: e.spentByCategory[b.categoryId] ?? 0,
    }))
    .filter((b) => b.limitCents > 0 && b.spent >= b.limitCents * 0.8)
    .sort((a, b) => b.spent / b.limitCents - a.spent / a.limitCents)
    .slice(0, 2);
  for (const m of metas) {
    const pct = Math.round((m.spent / m.limitCents) * 100);
    const nome = e.nomeCategoria(m.categoryId);
    out.push(
      pct >= 100
        ? {
            tom: 'warn',
            titulo: `${nome} passou da meta (${pct}%)`,
            texto: `${e.moeda(m.spent)} de ${e.moeda(m.limitCents)}.`,
          }
        : {
            tom: 'warn',
            titulo: `${nome} está em ${pct}% da meta`,
            texto: `${e.moeda(m.spent)} de ${e.moeda(m.limitCents)}, faltando ${e.daysLeft} ${e.daysLeft === 1 ? 'dia' : 'dias'}.`,
          },
    );
  }

  const acima = categoriesAboveNormal(e.txs, e.month)[0];
  if (acima)
    out.push({
      tom: 'warn',
      titulo: `${e.nomeCategoria(acima.categoryId)} está ${acima.pct}% acima da média`,
      texto: `${e.moeda(acima.spentCents)} contra ${e.moeda(acima.avgCents)} nos meses anteriores.`,
    });

  const incomum = unusualTransactions(e.txs, e.month)[0];
  if (incomum)
    out.push({
      tom: 'info',
      titulo: `Gasto fora do padrão: ${incomum.description}`,
      texto: `${e.moeda(incomum.amountCents)}, cerca de ${incomum.times.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes o normal da categoria.`,
    });

  if (e.assinaturasId) {
    const nova = newSubscriptions(e.txs, e.assinaturasId, e.today)[0];
    if (nova)
      out.push({
        tom: 'info',
        titulo: `Assinatura nova de ${e.moeda(nova.amountCents)}`,
        texto: `${nova.description} apareceu em ${nova.firstSeen.slice(8)}/${nova.firstSeen.slice(5, 7)}. Confirme se é sua.`,
      });
  }

  const reajuste = repricedRecurrences(detectRecurrences(e.txs))[0];
  if (reajuste)
    out.push({
      tom: 'info',
      titulo: `${reajuste.description} subiu ${reajuste.pct.toLocaleString('pt-BR')}%`,
      texto: `De ${e.moeda(reajuste.fromCents)} para ${e.moeda(reajuste.toCents)} por mês.`,
    });

  return out.slice(0, MAX);
}
