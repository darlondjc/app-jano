import type { GoalDoc } from '@jano/data-access';

export interface AvaliacaoObjetivo {
  guardadoCents: number;
  faltaCents: number;
  pct: number;
  /** Meses até o prazo, contando o atual; 0 quando já passou. */
  meses: number;
  /** Quanto guardar por mês para chegar no prazo. */
  porMesCents: number;
  /**
   * concluido: já juntou; no-ritmo: cabe na sobra média; apertado: precisa mais que a
   * sobra; vencido: prazo passou sem juntar; sem-base: sem sobra média para comparar.
   */
  situacao: 'concluido' | 'no-ritmo' | 'apertado' | 'vencido' | 'sem-base';
  /** No ritmo da sobra média, em que mês (AAAA-MM) chega lá; null sem sobra positiva. */
  chegaEm: string | null;
}

export interface BaseObjetivos {
  /** Saldo da poupança no banco; null sem Open Finance. */
  poupancaCents: number | null;
  /** Sobra média por mês (receitas menos gastos dos meses fechados); null sem histórico. */
  sobraMediaCents: number | null;
  /** AAAA-MM */
  mesAtual: string;
}

const mesesEntre = (de: string, ate: string) => {
  const [ya, ma] = de.split('-').map(Number);
  const [yb, mb] = ate.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

const somarMeses = (mes: string, n: number) => {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Quanto falta, quanto guardar por mês até o prazo e se a sobra média dá conta. */
export function avaliarObjetivo(
  g: GoalDoc,
  b: BaseObjetivos,
): AvaliacaoObjetivo {
  const guardadoCents = Math.max(
    0,
    g.fonte === 'poupanca' ? (b.poupancaCents ?? 0) : g.guardadoCents,
  );
  const faltaCents = Math.max(0, g.alvoCents - guardadoCents);
  const pct = Math.min(100, Math.round((guardadoCents / g.alvoCents) * 100));
  // Prazo no próprio mês ainda conta um mês para guardar.
  const meses = Math.max(0, mesesEntre(b.mesAtual, g.prazo) + 1);
  const porMesCents = meses
    ? Math.ceil(faltaCents / meses / 100) * 100
    : faltaCents;
  const sobra = b.sobraMediaCents;
  const chegaEm =
    faltaCents && sobra && sobra > 0
      ? somarMeses(b.mesAtual, Math.ceil(faltaCents / sobra) - 1)
      : null;
  let situacao: AvaliacaoObjetivo['situacao'];
  if (!faltaCents) situacao = 'concluido';
  else if (!meses) situacao = 'vencido';
  else if (sobra === null) situacao = 'sem-base';
  else situacao = porMesCents <= sobra ? 'no-ritmo' : 'apertado';
  return {
    guardadoCents,
    faltaCents,
    pct,
    meses,
    porMesCents,
    situacao,
    chegaEm,
  };
}
