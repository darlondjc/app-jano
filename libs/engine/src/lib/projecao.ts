import { monthTotals, type Cents, type SpendTx } from './engine';
import { monthOf, previousMonths } from './insights';

export type TxProjecao = SpendTx & { date: string };

/** Ajustes "e se" aplicados sobre a projeção base. */
export type Cenario =
  /** Reduz o gasto médio de uma categoria em `pct`% a partir do mês seguinte. */
  | { tipo: 'cortar'; categoryId: string; pct: number }
  /** Nova despesa mensal fixa a partir do mês seguinte. */
  | { tipo: 'parcela'; cents: Cents }
  /** Entrada única `mesesAFrente` meses depois do mês atual. */
  | { tipo: 'renda'; cents: Cents; mesesAFrente: number };

export interface EntradaProjecao {
  txs: TxProjecao[];
  cartoes?: ReadonlySet<string>;
  /** Mês atual, AAAA-MM. */
  month: string;
  dia: number;
  diasNoMes: number;
  /** Quantos meses depois do atual mostrar. */
  horizonte: number;
  /** Saldo de hoje (0 quando a pessoa não informou). */
  saldoInicial: Cents;
  cenarios?: Cenario[];
}

export interface PontoProjecao {
  /** 0 = fim do mês atual, 1 = fim do mês seguinte… */
  k: number;
  mes: string;
  base: Cents;
  cenario: Cents;
  otimista: Cents;
  pessimista: Cents;
}

export interface ResultadoProjecao {
  pontos: PontoProjecao[];
  /** Saldo no fim dos meses anteriores (do mais antigo ao mais recente). */
  realizado: { mes: string; valor: Cents }[];
  hoje: Cents;
  /** Fração já decorrida do mês atual (0–1). */
  fracaoMes: number;
  receitaMedia: Cents;
  gastoMedio: Cents;
  /** Desvio das sobras mensais históricas (faixa de incerteza). */
  desvio: Cents;
  mesesBase: number;
  /** Efeito de cada cenário até o fim do horizonte, na ordem recebida. */
  efeitos: Cents[];
}

const MAX_MESES_BASE = 6;

function proximoMes(month: string, k: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + k;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Valor mensal de um cenário em um mês k >= 1 (positivo = melhora o saldo). */
function efeitoNoMes(
  c: Cenario,
  k: number,
  gastoMedioPorCategoria: Record<string, Cents>,
): Cents {
  switch (c.tipo) {
    case 'cortar':
      return k >= 1
        ? Math.round(
            ((gastoMedioPorCategoria[c.categoryId] ?? 0) * c.pct) / 100,
          )
        : 0;
    case 'parcela':
      return k >= 1 ? -c.cents : 0;
    case 'renda':
      return k === c.mesesAFrente ? c.cents : 0;
  }
}

/**
 * Projeção v1, explicável: sobra mensal = média ponderada (mais peso aos meses recentes,
 * até 6 meses encerrados) de receitas menos gastos por categoria. O resto do mês atual
 * completa a média; a faixa de incerteza cresce com a raiz do tempo, pelo desvio das
 * sobras passadas. Devolve null quando há menos de 2 meses encerrados com dados.
 */
export function projetar(e: EntradaProjecao): ResultadoProjecao | null {
  const comDados = previousMonths(e.month, MAX_MESES_BASE).filter((m) =>
    e.txs.some((t) => monthOf(t.date) === m && !t.isTransfer),
  );
  if (comDados.length < 2) return null;

  const resumos = comDados.map((m) =>
    monthTotals(
      e.txs.filter((t) => monthOf(t.date) === m),
      e.cartoes,
    ),
  );
  const pesos = comDados.map((_, i) => comDados.length - i);
  const somaPesos = pesos.reduce((s, p) => s + p, 0);
  const ponderar = (valores: number[]) =>
    valores.reduce((s, v, i) => s + v * pesos[i], 0) / somaPesos;

  const receitaMedia = Math.round(ponderar(resumos.map((r) => r.income)));
  const categorias = new Set(
    resumos.flatMap((r) => Object.keys(r.spentByCategory)),
  );
  const gastoMedioPorCategoria: Record<string, Cents> = {};
  for (const c of categorias)
    gastoMedioPorCategoria[c] = Math.round(
      ponderar(resumos.map((r) => r.spentByCategory[c] ?? 0)),
    );
  const gastoMedio = Object.values(gastoMedioPorCategoria).reduce(
    (s, v) => s + v,
    0,
  );

  const sobras = resumos.map((r) => r.net);
  const media = sobras.reduce((s, v) => s + v, 0) / sobras.length;
  const desvio = Math.round(
    Math.sqrt(sobras.reduce((s, v) => s + (v - media) ** 2, 0) / sobras.length),
  );

  const atual = monthTotals(
    e.txs.filter((t) => monthOf(t.date) === e.month),
    e.cartoes,
  );
  const restoReceita = Math.max(receitaMedia - atual.income, 0);
  const restoGasto = Math.max(gastoMedio - atual.spent, 0);
  const fracaoMes = Math.min(Math.max(e.dia / e.diasNoMes, 0), 1);

  const sobraMensal = receitaMedia - gastoMedio;
  const cenarios = e.cenarios ?? [];
  const pontos: PontoProjecao[] = [];
  let base = e.saldoInicial + restoReceita - restoGasto;
  let comCenario = base;
  const efeitos = cenarios.map(() => 0);
  for (let k = 0; k <= e.horizonte; k++) {
    if (k >= 1) {
      base += sobraMensal;
      comCenario += sobraMensal;
      cenarios.forEach((c, i) => {
        const v = efeitoNoMes(c, k, gastoMedioPorCategoria);
        comCenario += v;
        efeitos[i] += v;
      });
    }
    const faixa = Math.round(
      desvio * Math.sqrt(k === 0 ? 1 - fracaoMes : k + (1 - fracaoMes)),
    );
    pontos.push({
      k,
      mes: proximoMes(e.month, k),
      base,
      cenario: comCenario,
      otimista: base + faixa,
      pessimista: base - faixa,
    });
  }

  // Saldo no fim dos meses anteriores, voltando do saldo de hoje.
  const realizado: { mes: string; valor: Cents }[] = [];
  let saldo = e.saldoInicial - atual.net;
  for (const m of previousMonths(e.month, 3)) {
    realizado.unshift({ mes: m, valor: saldo });
    saldo -= monthTotals(
      e.txs.filter((t) => monthOf(t.date) === m),
      e.cartoes,
    ).net;
  }

  return {
    pontos,
    realizado,
    hoje: e.saldoInicial,
    fracaoMes,
    receitaMedia,
    gastoMedio,
    desvio,
    mesesBase: comDados.length,
    efeitos,
  };
}

/** Próxima data (AAAA-MM-DD) de uma cobrança que cai todo mês no `dia`. */
export function proximaCobranca(dia: number, hoje: string): string {
  const [y, m, d] = hoje.split('-').map(Number);
  const ultimo = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();
  const noMes = (ano: number, mes: number) =>
    `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo(ano, mes))).padStart(2, '0')}`;
  const estaVez = noMes(y, m);
  if (Number(estaVez.slice(8)) >= d) return estaVez;
  return m === 12 ? noMes(y + 1, 1) : noMes(y, m + 1);
}
