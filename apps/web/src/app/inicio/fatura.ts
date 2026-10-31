import { proximaCobranca } from '@jano/engine';
import { nomeSemPrefixo } from '@jano/import-file';
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
  /** Fatura fechada: o que já entrou na seguinte. */
  seguinte: { totalCents: number; compras: number; desde: string } | null;
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
}

const dias = (de: string, ate: string) =>
  Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) /
      86_400_000,
  );

const mesAntes = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};

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
        nome: nomeSemPrefixo(t.description),
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
  const vence =
    c?.vencimento ??
    (diaPago === null ? null : proximaCobranca(diaPago, e.hoje));

  let valorCents = Math.max(0, saldo?.balanceCents ?? 0);
  let base: Base;
  let seguinte: CartaoFatura['seguinte'] = null;
  if (fase === 'fechada' && c?.fechamento) {
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

  let situacao = 'vencimento a confirmar';
  if (fase === 'aberta' && c?.fechamento)
    situacao = emDias(dias(e.hoje, c.fechamento), 'fecha');
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
      nome: nomeSemPrefixo(p.nome),
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
    nome: saldo?.name ?? 'Cartão de crédito',
    final: saldo?.number
      ? saldo.number.replace(/\D/g, '').slice(-4) || null
      : null,
    bandeira: c?.bandeira ?? null,
    accountId,
    fase,
    valorCents,
    fecha: c?.fechamento ?? null,
    vence,
    minimoCents: c?.minimoCents ?? null,
    situacao,
    limite,
    composicao: partes(base.porCategoria),
    compras: base.compras,
    maiores: base.maiores.slice(0, MAIORES),
    seguinte,
    todoMes: { totalCents: itens.reduce((s, i) => s + i.cents, 0), itens },
  };
}
