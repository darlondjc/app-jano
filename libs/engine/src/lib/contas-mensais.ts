import type { Cents, GoalStatus } from './engine';
import { goalStatus, partes } from './engine';
import { monthOf, previousMonths, type HistTx } from './insights';

export interface ContaDoMes {
  /** Quanto a categoria costuma pagar no mês (média dos dois meses anteriores). */
  esperadoCents: Cents;
  /** Quanto já saiu neste mês. */
  pagoCents: Cents;
  /** O que ainda deve sair (0 = contas do mês pagas). */
  faltaCents: Cents;
}

/** Nome do lançamento sem números (datas, horas, códigos), para reconhecer a mesma conta. */
const marca = (descricao: string) =>
  descricao
    .replace(/[\d/:.,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Variação aceita no total de um mês para o outro (conta de luz, água). */
const VARIACAO = 0.15;
/** Pago a partir de 90% do esperado conta como pago. */
const QUITADO = 0.9;
const MAX_LANCAMENTOS = 3;

/**
 * Categorias que funcionam como contas do mês (aluguel, escola, luz): nos dois meses
 * anteriores, de 1 a 3 lançamentos, um por pagador, sempre os mesmos, com total parecido; e neste
 * mês nada fora deles. Para elas, ritmo do mês não faz sentido: o que importa é se já foram
 * pagas e quanto ainda falta.
 */
export function contasDoMes(
  txs: HistTx[],
  month: string,
): Map<string, ContaDoMes> {
  const [m1, m2] = previousMonths(month, 2);
  const porMes = new Map<
    string,
    Map<string, { cents: Cents; marcas: string[] }>
  >();
  for (const t of txs) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const mes = monthOf(t.date);
    if (mes !== month && mes !== m1 && mes !== m2) continue;
    const doMes = porMes.get(mes) ?? porMes.set(mes, new Map()).get(mes)!;
    for (const p of partes(t)) {
      if (!p.categoryId) continue;
      const c =
        doMes.get(p.categoryId) ??
        doMes.set(p.categoryId, { cents: 0, marcas: [] }).get(p.categoryId)!;
      c.cents += -p.amountCents;
      c.marcas.push(marca(t.descriptionNorm));
    }
  }

  const out = new Map<string, ContaDoMes>();
  for (const [categoryId, a] of porMes.get(m1) ?? []) {
    const b = porMes.get(m2)?.get(categoryId);
    if (!b) continue;
    if (a.marcas.length > MAX_LANCAMENTOS || b.marcas.length > MAX_LANCAMENTOS)
      continue;
    // Conta vem uma vez por mês de cada pagador; duas idas ao mesmo lugar é consumo.
    const unicas = (m: string[]) => new Set(m).size === m.length;
    const iguais =
      unicas(a.marcas) &&
      unicas(b.marcas) &&
      [...a.marcas].sort().join('|') === [...b.marcas].sort().join('|');
    const parecidos =
      Math.abs(a.cents - b.cents) <= Math.max(a.cents, b.cents) * VARIACAO;
    if (!iguais || !parecidos) continue;
    const atual = porMes.get(month)?.get(categoryId);
    const conhecidas = new Set(a.marcas);
    if (atual?.marcas.some((x) => !conhecidas.has(x))) continue;
    if (atual && !unicas(atual.marcas)) continue;
    const esperadoCents = Math.round((a.cents + b.cents) / 2);
    const pagoCents = atual?.cents ?? 0;
    out.set(categoryId, {
      esperadoCents,
      pagoCents,
      faltaCents:
        pagoCents >= esperadoCents * QUITADO
          ? 0
          : Math.max(0, esperadoCents - pagoCents),
    });
  }
  return out;
}

/** Gastar mais que o ritmo do mês por esta folga já pede atenção. */
const FOLGA_RITMO = 0.15;

/**
 * Estado de uma meta, numa regra só para a barra, o resumo do Orçamento e os avisos.
 * Contas do mês só alertam se o que já saiu mais o que falta passar do limite. As outras
 * seguem o percentual (atenção a partir de 80%) e, abaixo disso, o ritmo do mês.
 */
export function estadoDaMeta(e: {
  spentCents: Cents;
  limitCents: Cents;
  /** Fração do mês decorrida; omitir em meses encerrados. */
  pace?: number;
  conta?: ContaDoMes;
}): { status: GoalStatus; adiantada: boolean } {
  if (e.conta)
    return {
      status: e.spentCents + e.conta.faltaCents > e.limitCents ? 'over' : 'ok',
      adiantada: false,
    };
  const s = goalStatus(e.spentCents, e.limitCents);
  const ratio = e.limitCents > 0 ? e.spentCents / e.limitCents : 0;
  const adiantada =
    e.pace !== undefined &&
    e.pace < 1 &&
    e.limitCents > 0 &&
    ratio >= 0.25 &&
    ratio < 0.8 &&
    ratio > e.pace + FOLGA_RITMO;
  return { status: s === 'ok' && adiantada ? 'warning' : s, adiantada };
}
