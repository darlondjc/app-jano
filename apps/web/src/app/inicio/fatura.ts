import { proximaCobranca } from '@jano/engine';
import { ehPagamentoDeFatura, nomeDeExibicao } from '@jano/import-file';
import type { BalanceDoc } from '@jano/data-access';
import { cobrancasFixas, diaDaFatura, series } from '../projecoes/plano';
import { parcelamentos, type TxRec } from '../recorrencias/linhas';

/** Quantas categorias aparecem antes de agrupar o resto em "Outras". */
const CATEGORIAS = 4;
const MAIORES = 3;

export interface ParteFatura {
  /** null = sem categoria; "outras" = agrupadas. */
  categoryId: string | null;
  cents: number;
  pct: number;
}

export interface CartaoFatura {
  nome: string;
  final: string | null;
  bandeira: string | null;
  /** Conta do cartão no Jano, para "Ver compras do cartão". */
  accountId: string | null;
  /** aberta: ainda recebe compras; fechada: esperando o pagamento; estimada: sem datas do banco. */
  fase: 'aberta' | 'fechada' | 'estimada';
  valorCents: number;
  fecha: string | null;
  vence: string | null;
  minimoCents: number | null;
  /** "fecha em 5 dias", "vence em 3 dias", "vence hoje"... */
  situacao: string;
  limite: {
    limiteCents: number;
    usadoCents: number;
    disponivelCents: number;
    pct: number;
  } | null;
  composicao: ParteFatura[];
  compras: number;
  maiores: {
    nome: string;
    cents: number;
    date: string;
    categoryId: string | null;
  }[];
  /** A fatura fechada já foi paga: o cartão passa a mostrar a aberta. */
  paga: { cents: number; date: string } | null;
  /** Fatura fechada: o que já entrou na seguinte. */
  seguinte: { totalCents: number; compras: number; desde: string } | null;
  /** Dias informados pelo usuário em uso (null = datas do banco ou desconhecidas). */
  diasInformados: DiasDaFatura | null;
  /** O valor é o da fatura informada pelo banco (não a soma das compras). */
  valorDoBanco: boolean;
  /** Saldo devedor total no banco, quando é maior que a fatura (parcelas futuras). */
  totalNoCartaoCents: number | null;
  /** O que cai no cartão todo mês: parcelas que continuam e assinaturas. */
  todoMes: {
    totalCents: number;
    itens: { nome: string; detalhe: string; cents: number }[];
  };
}

export interface EntradaFatura {
  /** Saldos do banco; usa o primeiro cartão. */
  saldos: BalanceDoc[];
  txs: (TxRec & { accountId: string; description: string })[];
  cartoes: ReadonlySet<string>;
  /** AAAA-MM-DD */
  hoje: string;
  /** Dias de fechamento e vencimento informados pelo usuário (quando o banco não manda). */
  dias?: DiasDaFatura | null;
}

export interface DiasDaFatura {
  /** Dia do mês em que a fatura fecha. */
  fecha: number;
  /** Dia do mês em que ela vence. */
  vence: number;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** Data com o dia `d` no mês de `iso` (dia 31 vira o último dia em meses curtos). */
const noDia = (iso: string, d: number) => {
  const [y, m] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${doisDigitos(m)}-${doisDigitos(Math.min(d, ultimo))}`;
};

/**
 * Datas da fatura pelos dias informados: o último fechamento antes de hoje (no dia do
 * fechamento a fatura ainda está aberta), o anterior a ele e o vencimento dela.
 */
export function datasPelosDias(
  d: DiasDaFatura,
  hoje: string,
): { fechou: string; anterior: string; vence: string; proxima: string } {
  let fechou = noDia(hoje, d.fecha);
  if (fechou >= hoje) fechou = noDia(somarMes(hoje, -1), d.fecha);
  const anterior = noDia(somarMes(fechou, -1), d.fecha);
  const proxima = noDia(somarMes(fechou, 1), d.fecha);
  // Vence depois do fechamento: no mesmo mês se o dia vier depois, senão no seguinte.
  const vence =
    d.vence > d.fecha
      ? noDia(fechou, d.vence)
      : noDia(somarMes(fechou, 1), d.vence);
  return { fechou, anterior, vence, proxima };
}

const dias = (de: string, ate: string) =>
  Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) /
      86_400_000,
  );

const somarMes = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const mesAntes = (iso: string) => somarMes(iso, -1);
const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Pagamento da fatura feito depois do fechamento: a saída na conta ("PAGTO CARTAO") ou o
 * crédito no próprio cartão. Usa o maior dos dois lados, para não contar o mesmo duas vezes.
 */
function pagamentoDepois(
  txs: EntradaFatura['txs'],
  cartaoId: string | null,
  cartoes: ReadonlySet<string>,
  desde: string,
  hoje: string,
): { cents: number; date: string } | null {
  const periodo = txs.filter((t) => t.date > desde && t.date <= hoje);
  const naConta = periodo.filter(
    (t) =>
      !cartoes.has(t.accountId) &&
      t.isTransfer &&
      t.amountCents < 0 &&
      ehPagamentoDeFatura(t.descriptionNorm),
  );
  const noCartao = periodo.filter(
    (t) => t.accountId === cartaoId && t.isTransfer && t.amountCents > 0,
  );
  const soma = (l: typeof periodo) =>
    l.reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const lado = soma(naConta) >= soma(noCartao) ? naConta : noCartao;
  if (!lado.length) return null;
  return {
    cents: soma(lado),
    date: lado.map((t) => t.date).sort()[0],
  };
}

function emDias(n: number, verbo: string): string {
  if (n === 0) return `${verbo} hoje`;
  if (n === 1) return `${verbo} amanhã`;
  return `${verbo} em ${n} dias`;
}

/** Partes por categoria, com as menores agrupadas em "Outras". */
function partes(
  porCategoria: { categoryId: string | null; cents: number }[],
): ParteFatura[] {
  const total = porCategoria.reduce((s, p) => s + p.cents, 0) || 1;
  const ordenadas = [...porCategoria].sort((a, b) => b.cents - a.cents);
  const topo = ordenadas.slice(0, CATEGORIAS);
  const resto = ordenadas.slice(CATEGORIAS).reduce((s, p) => s + p.cents, 0);
  const lista = resto
    ? [...topo, { categoryId: 'outras', cents: resto }]
    : topo;
  return lista.map((p) => ({
    ...p,
    pct: Math.round((p.cents / total) * 100),
  }));
}

type Base = Pick<CartaoFatura, 'compras' | 'maiores'> & {
  porCategoria: { categoryId: string | null; cents: number }[];
};

/** Resumo das compras gravadas do cartão num período (fatura fechada ou estimativa). */
function dasTransacoes(
  txs: EntradaFatura['txs'],
  de: string,
  ate: string,
): Base {
  const compras = txs.filter(
    (t) => !t.isTransfer && t.date > de && t.date <= ate,
  );
  const porCat = new Map<string | null, number>();
  for (const t of compras)
    porCat.set(t.categoryId, (porCat.get(t.categoryId) ?? 0) - t.amountCents);
  return {
    porCategoria: [...porCat]
      .map(([categoryId, cents]) => ({ categoryId, cents }))
      .filter((p) => p.cents > 0),
    compras: compras.filter((t) => t.amountCents < 0).length,
    maiores: compras
      .filter((t) => t.amountCents < 0)
      .sort((a, b) => a.amountCents - b.amountCents)
      .slice(0, MAIORES)
      .map((t) => ({
        nome: nomeDeExibicao(t.description),
        cents: -t.amountCents,
        date: t.date,
        categoryId: t.categoryId,
      })),
  };
}

/**
 * Tudo o que o cartão da fatura mostra: situação, valor, datas, limite, para onde foi o
 * dinheiro, as maiores compras e o que cai no cartão todo mês. `null` sem cartão.
 */
export function cartaoDaFatura(e: EntradaFatura): CartaoFatura | null {
  const saldo = e.saldos.find((b) => b.kind === 'cartao');
  if (!saldo && !e.cartoes.size) return null;
  const accountId =
    saldo?.accountId ?? (e.cartoes.size ? [...e.cartoes][0] : null);
  const doCartao = e.txs.filter((t) => t.accountId === accountId);
  const contas = e.txs.filter((t) => !e.cartoes.has(t.accountId));
  const c = saldo?.credito ?? null;
  const aberta = saldo?.faturaAberta ?? null;

  let fase: CartaoFatura['fase'] = 'estimada';
  if (c?.fechamento) fase = c.fechamento < e.hoje ? 'fechada' : 'aberta';
  const diaPago = diaDaFatura(contas);
  let vence =
    c?.vencimento ??
    (diaPago === null ? null : proximaCobranca(diaPago, e.hoje));
  let fecha = c?.fechamento ?? null;
  let minimoCents = c?.minimoCents ?? null;

  // Fechada e já paga (até R$ 1 de diferença): o que importa agora é a fatura aberta.
  let paga: CartaoFatura['paga'] = null;
  const fechouEm = c?.fechamento ?? null;
  if (fase === 'fechada' && fechouEm) {
    const p = pagamentoDepois(e.txs, accountId, e.cartoes, fechouEm, e.hoje);
    // Valor da fechada pelas compras gravadas: o saldo do banco já pode ser o da aberta.
    const fechadaCents = -doCartao
      .filter(
        (t) =>
          !t.isTransfer && t.date > mesAntes(fechouEm) && t.date <= fechouEm,
      )
      .reduce((s, t) => s + t.amountCents, 0);
    if (p && p.cents >= fechadaCents - 100) {
      paga = p;
      fase = 'aberta';
      fecha = somarMes(fechouEm, 1);
      if (vence) vence = somarMes(vence, 1);
      minimoCents = null;
    }
  }

  let valorCents = Math.max(0, saldo?.balanceCents ?? 0);
  let base: Base;
  let seguinte: CartaoFatura['seguinte'] = null;
  // Sem datas do banco, valem os dias que a pessoa informou; o valor sai das compras do
  // ciclo, porque o saldo do banco inclui as parcelas que ainda vão vencer.
  const manual = !c?.fechamento && e.dias ? e.dias : null;
  if (manual) {
    const d = datasPelosDias(manual, e.hoje);
    const soma = (de: string, ate: string) =>
      -doCartao
        .filter((t) => !t.isTransfer && t.date > de && t.date <= ate)
        .reduce((s, t) => s + t.amountCents, 0);
    const p = pagamentoDepois(e.txs, accountId, e.cartoes, d.fechou, e.hoje);
    const fechadaCents = soma(d.anterior, d.fechou);
    // Entre o fechamento e o vencimento, a fechada é a que importa; paga ou vencida (o
    // pagamento pode não ter um nome reconhecível), passa a valer a aberta.
    if (e.hoje <= d.vence && !(p && p.cents >= fechadaCents - 100)) {
      fase = 'fechada';
      fecha = d.fechou;
      vence = d.vence;
      valorCents = Math.max(0, fechadaCents);
      base = dasTransacoes(doCartao, d.anterior, d.fechou);
      const depois = dasTransacoes(doCartao, d.fechou, e.hoje);
      const total = soma(d.fechou, e.hoje);
      if (depois.compras)
        seguinte = {
          totalCents: total,
          compras: depois.compras,
          desde: somarDias(d.fechou, 1),
        };
    } else {
      fase = 'aberta';
      if (p && p.cents >= fechadaCents - 100) paga = p;
      fecha = d.proxima;
      vence = datasPelosDias(manual, somarDias(d.proxima, 1)).vence;
      valorCents = Math.max(0, soma(d.fechou, e.hoje));
      base = dasTransacoes(doCartao, d.fechou, e.hoje);
    }
    minimoCents = null;
  } else if (paga && fechouEm) {
    base = aberta ?? dasTransacoes(doCartao, fechouEm, e.hoje);
    valorCents =
      aberta?.totalCents ??
      -doCartao
        .filter((t) => !t.isTransfer && t.date > fechouEm)
        .reduce((s, t) => s + t.amountCents, 0);
  } else if (fase === 'fechada' && c?.fechamento) {
    // Fechada: as compras dela já estão gravadas; o resumo da sincronização é a seguinte.
    base = dasTransacoes(doCartao, mesAntes(c.fechamento), c.fechamento);
    if (aberta?.compras)
      seguinte = {
        totalCents: aberta.totalCents,
        compras: aberta.compras,
        desde: aberta.desde,
      };
  } else if (aberta) {
    base = aberta;
    if (fase === 'aberta') valorCents = aberta.totalCents;
  } else {
    base = dasTransacoes(doCartao, mesAntes(e.hoje), e.hoje);
  }

  // Valor oficial: a fatura fechada como o banco informa (com encargos, créditos e
  // parcelas do jeito do banco). Vale quando é a mesma fatura que o card mostra.
  // A lista pode trazer também a próxima fatura (ainda aberta): escolhe a que corresponde
  // à mostrada. Com os dias informados, a de vencimento mais perto do calculado; sem eles, a
  // primeira que ainda não venceu.
  const faturas = !c?.fechamento ? (saldo?.faturasBanco ?? []) : [];
  let valorDoBanco = false;
  const oficial = manual
    ? fase === 'fechada' && vence
      ? (faturas
          .filter((f) => Math.abs(dias(f.vencimento, vence as string)) <= 5)
          .sort(
            (a, b) =>
              Math.abs(dias(a.vencimento, vence as string)) -
              Math.abs(dias(b.vencimento, vence as string)),
          )[0] ?? null)
      : null
    : ([...faturas]
        .filter((f) => f.vencimento >= e.hoje)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null);
  if (oficial) {
    if (!manual) fase = 'fechada';
    vence = oficial.vencimento;
    valorCents = oficial.totalCents;
    minimoCents = oficial.minimoCents;
    valorDoBanco = true;
  }

  const totalNoCartaoCents =
    (manual || valorDoBanco) && saldo && saldo.balanceCents > valorCents + 100
      ? saldo.balanceCents
      : null;

  let situacao = 'vencimento a confirmar';
  if (fase === 'aberta' && fecha)
    situacao = emDias(dias(e.hoje, fecha), 'fecha');
  else if (vence) {
    const n = dias(e.hoje, vence);
    situacao = n < 0 ? 'vencida' : emDias(n, 'vence');
  }

  const parcelas = parcelamentos(doCartao, e.hoje).filter(
    (p) => (p.parcela?.faltam ?? 0) >= 1,
  );
  const assinaturas = cobrancasFixas(
    series(
      doCartao.filter((t) => !t.installment),
      'gasto',
    ),
  );
  const itens = [
    ...parcelas.map((p) => ({
      nome: nomeDeExibicao(p.nome),
      detalhe: `parcela ${(p.parcela?.n ?? 0) + 1} de ${p.parcela?.total}`,
      cents: p.cents,
    })),
    ...assinaturas.map(({ s, nome }) => ({
      nome,
      detalhe: 'todo mês',
      cents: s.amountCents,
    })),
  ].sort((a, b) => b.cents - a.cents);

  const limite =
    c?.limiteCents && c.disponivelCents !== null
      ? {
          limiteCents: c.limiteCents,
          disponivelCents: c.disponivelCents,
          usadoCents: c.limiteCents - c.disponivelCents,
          pct: Math.round(
            ((c.limiteCents - c.disponivelCents) / c.limiteCents) * 100,
          ),
        }
      : null;

  return {
    nome: saldo ? nomeDeExibicao(saldo.name) : 'Cartão de crédito',
    final: saldo?.number
      ? saldo.number.replace(/\D/g, '').slice(-4) || null
      : null,
    bandeira: c?.bandeira ?? null,
    accountId,
    fase,
    valorCents,
    fecha,
    vence,
    minimoCents,
    situacao,
    limite,
    diasInformados: e.dias ?? null,
    valorDoBanco,
    totalNoCartaoCents,
    composicao: partes(base.porCategoria),
    compras: base.compras,
    maiores: base.maiores.slice(0, MAIORES),
    paga,
    seguinte,
    todoMes: { totalCents: itens.reduce((s, i) => s + i.cents, 0), itens },
  };
}

/** Id reservado da meta de orçamento da fatura do cartão (não é uma categoria). */
export const META_FATURA = '__fatura__';

export interface CicloDaFatura {
  /** Compras do cartão no ciclo aberto, menos estornos. */
  gastoCents: number;
  /** Fração do ciclo decorrida (0–1). */
  ritmo: number;
  /** Dias até o fechamento. */
  diasRestantes: number;
  /** AAAA-MM-DD do fechamento; null quando o ciclo é o período (sem dias informados). */
  fecha: string | null;
}

/**
 * Ciclo aberto da fatura, para a meta "Fatura do cartão": do dia seguinte ao último
 * fechamento até o próximo. Sem os dias informados, vale o período financeiro passado em
 * `semDias` (a fatura não tem como ser separada).
 */
export function cicloDaFatura(e: {
  txs: {
    accountId: string;
    date: string;
    amountCents: number;
    isTransfer: boolean;
  }[];
  cartoes: ReadonlySet<string>;
  dias: DiasDaFatura | null;
  hoje: string;
  semDias: { inicio: string; fim: string };
}): CicloDaFatura {
  const de = e.dias
    ? datasPelosDias(e.dias, e.hoje).fechou
    : somarDias(e.semDias.inicio, -1);
  const ate = e.dias ? datasPelosDias(e.dias, e.hoje).proxima : e.semDias.fim;
  const gastoCents = Math.max(
    0,
    -e.txs
      .filter(
        (t) =>
          e.cartoes.has(t.accountId) &&
          !t.isTransfer &&
          t.date > de &&
          t.date <= e.hoje,
      )
      .reduce((s, t) => s + t.amountCents, 0),
  );
  const total = Math.max(1, dias(de, ate));
  return {
    gastoCents,
    ritmo: Math.min(1, Math.max(0, dias(de, e.hoje) / total)),
    diasRestantes: Math.max(0, dias(e.hoje, ate)),
    fecha: e.dias ? ate : null,
  };
}
