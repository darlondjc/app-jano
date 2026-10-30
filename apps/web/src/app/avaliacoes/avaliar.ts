import { ehEstorno, monthTotals, type ScorePart } from '@jano/engine';

export interface TxAval {
  date: string;
  amountCents: number;
  categoryId: string | null;
  description: string;
  descriptionNorm: string;
  isTransfer: boolean;
  accountId: string;
}

type Cartoes = ReadonlySet<string>;

/** Gasto total por categoria em um mês (estornos do cartão abatidos). */
export function gastoDoMes(
  txs: TxAval[],
  month: string,
  cartoes?: Cartoes,
  ateODia?: number,
): { total: number; porCategoria: Record<string, number> } {
  const doMes = txs.filter(
    (t) =>
      t.date.startsWith(month) &&
      (ateODia === undefined || Number(t.date.slice(8, 10)) <= ateODia),
  );
  const m = monthTotals(doMes, cartoes);
  return { total: m.spent, porCategoria: m.spentByCategory };
}

/** Meses AAAA-MM, do mais antigo ao `month`, em `n` posições. */
export function ultimosMeses(month: string, n: number): string[] {
  let [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export interface Comparativo {
  /** Variação do gasto até o mesmo dia do mês anterior; null sem base de comparação. */
  pct: number | null;
  atual: number;
  anterior: number;
}

/** Compara o gasto do mês até hoje com o mesmo trecho do mês anterior. */
export function compararComAnterior(
  txs: TxAval[],
  month: string,
  dia: number,
  cartoes?: Cartoes,
): Comparativo {
  const anterior = ultimosMeses(month, 2)[0];
  const a = gastoDoMes(txs, month, cartoes, dia).total;
  const b = gastoDoMes(txs, anterior, cartoes, dia).total;
  return {
    atual: a,
    anterior: b,
    pct: b > 0 ? Math.round((a / b - 1) * 100) : null,
  };
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "Você gastou 8% menos que em setembro, mas Lazer subiu 24%." */
export function fraseResumo(
  c: Comparativo,
  month: string,
  destaque: { nome: string; pct: number } | null,
): string {
  if (c.pct === null)
    return 'Ainda não há um mês anterior para comparar. Continue importando para ver a leitura do mês.';
  const mesAnterior = MESES[(Number(month.slice(5, 7)) + 10) % 12];
  const base =
    c.pct === 0
      ? `Você gastou o mesmo que em ${mesAnterior}`
      : `Você gastou ${Math.abs(c.pct)}% ${c.pct < 0 ? 'menos' : 'mais'} que em ${mesAnterior}`;
  if (!destaque) return `${base}.`;
  const liga = c.pct < 0 ? 'mas' : 'e';
  return `${base}, ${liga} ${destaque.nome} subiu ${destaque.pct}%.`;
}

export interface SerieMensal {
  categoryId: string;
  /** Um valor por mês, na ordem de `meses`. */
  valores: number[];
}

/** As `n` categorias com mais gasto no período, mês a mês. */
export function serieMensal(
  txs: TxAval[],
  meses: string[],
  cartoes?: Cartoes,
  n = 3,
): SerieMensal[] {
  const porMes = meses.map((m) => gastoDoMes(txs, m, cartoes).porCategoria);
  const total = new Map<string, number>();
  for (const p of porMes)
    for (const [k, v] of Object.entries(p))
      if (k) total.set(k, (total.get(k) ?? 0) + v);
  return [...total]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([categoryId]) => ({
      categoryId,
      valores: porMes.map((p) => p[categoryId] ?? 0),
    }));
}

export interface Fatia {
  categoryId: string | null;
  cents: number;
  pct: number;
}

/** Distribuição do gasto: as maiores categorias e o resto em "Outras" (categoryId null). */
export function distribuicao(
  porCategoria: Record<string, number>,
  maximo = 5,
): Fatia[] {
  const itens = Object.entries(porCategoria)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = itens.reduce((s, [, v]) => s + v, 0);
  if (!total) return [];
  const topo = itens.slice(0, maximo);
  const resto = itens.slice(maximo).reduce((s, [, v]) => s + v, 0);
  const fatias: Fatia[] = topo.map(([k, v]) => ({
    categoryId: k || null,
    cents: v,
    pct: Math.round((v / total) * 100),
  }));
  if (resto > 0)
    fatias.push({
      categoryId: null,
      cents: resto,
      pct: Math.round((resto / total) * 100),
    });
  return fatias;
}

export interface Estabelecimento {
  nome: string;
  cents: number;
  compras: number;
  categoryId: string | null;
}

/** Onde mais se gastou no mês, agrupando pelo nome normalizado. */
export function maioresEstabelecimentos(
  txs: TxAval[],
  month: string,
  n = 5,
): Estabelecimento[] {
  const grupos = new Map<string, Estabelecimento>();
  for (const t of txs) {
    if (!t.date.startsWith(month) || t.isTransfer || t.amountCents >= 0)
      continue;
    const g = grupos.get(t.descriptionNorm) ?? {
      nome: t.description,
      cents: 0,
      compras: 0,
      categoryId: t.categoryId,
    };
    g.cents += -t.amountCents;
    g.compras += 1;
    grupos.set(t.descriptionNorm, g);
  }
  return [...grupos.values()].sort((a, b) => b.cents - a.cents).slice(0, n);
}

/** Texto curto de cada parte da nota, em linguagem simples. */
export function explicarNota(parts: ScorePart[]): string[] {
  const nome: Record<ScorePart['name'], string> = {
    'metas-no-ritmo': 'Metas no ritmo',
    'sobra-projetada': 'Sobra prevista',
    estabilidade: 'Estabilidade do gasto',
  };
  return parts.map(
    (p) => `${nome[p.name]}: ${Math.round(p.points)} de ${p.max} pontos`,
  );
}

export { ehEstorno };
