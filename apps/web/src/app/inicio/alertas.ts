import {
  categoriesAboveNormal,
  contasDoMes,
  detectRecurrences,
  newSubscriptions,
  repricedRecurrences,
  unusualTransactions,
  type HistTx,
} from '@jano/engine';
import { nomeDeExibicao } from '@jano/import-file';

export interface Alerta {
  /** Estável no mês (não muda com os números): é o que se guarda ao dispensar. */
  id: string;
  tom: 'warn' | 'info' | 'good';
  titulo: string;
  texto: string;
  /** Link de ação do cartão (usado na tela Avaliações). */
  acao?: {
    rotulo: string;
    rota: string;
    /** `tx` leva Transações direto ao lançamento (ver `Transacoes.irParaLancamento`). */
    queryParams?: Record<string, string>;
  };
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
  /** Quantos alertas devolver (padrão 3). */
  max?: number;
  /** Ids dispensados neste mês: saem e abrem espaço para o próximo. */
  dispensados?: ReadonlySet<string>;
}

/** O Início mostra no máximo três; a lista completa fica em Avaliações. */
const MAX = 3;

/** "Para ver hoje": o que merece atenção, do mais urgente ao menos, um aviso por assunto. */
export function montarAlertas(e: EntradaAlertas): Alerta[] {
  const out: Alerta[] = [];
  // Contas do mês (aluguel, escola) chegam a 100% quando pagas: só alertam se passarem.
  const contas = contasDoMes(e.txs, e.month);

  // Um aviso por assunto: meta, gasto acima da média e compra fora do padrão da mesma
  // categoria viram um aviso só, com os três números.
  const acimas = categoriesAboveNormal(e.txs, e.month);
  const incomuns = unusualTransactions(e.txs, e.month);
  const usadas = new Set<string>();
  const extras = (categoryId: string, semAcima = false) => {
    const partes: string[] = [];
    const acima = acimas.find((a) => a.categoryId === categoryId);
    if (acima && !semAcima)
      partes.push(
        `${acima.pct}% acima do normal (${e.moeda(acima.avgCents)} por mês)`,
      );
    const incomum = incomuns.find((i) => i.categoryId === categoryId);
    if (incomum)
      partes.push(
        `a maior foi ${exibir(incomum)}, ${e.moeda(incomum.amountCents)}`,
      );
    usadas.add(categoryId);
    return {
      texto: partes.length
        ? ` ${partes.join('; ').replace(/^./, (c) => c.toUpperCase())}.`
        : '',
      incomum,
    };
  };

  const metas = e.budgets
    .map((b) => ({
      ...b,
      spent: e.spentByCategory[b.categoryId] ?? 0,
    }))
    .filter((b) => b.limitCents > 0 && b.spent >= b.limitCents * 0.8)
    .filter((b) => !contas.has(b.categoryId) || b.spent > b.limitCents)
    .sort((a, b) => b.spent / b.limitCents - a.spent / a.limitCents)
    .slice(0, 2);
  for (const m of metas) {
    const pct = Math.round((m.spent / m.limitCents) * 100);
    const nome = e.nomeCategoria(m.categoryId);
    const x = extras(m.categoryId);
    out.push(
      m.spent > m.limitCents
        ? {
            id: `meta-passou:${m.categoryId}`,
            tom: 'warn',
            titulo: `${nome} passou da meta (${pct}%)`,
            texto: `${e.moeda(m.spent)} de ${e.moeda(m.limitCents)}.${x.texto}`,
            acao: { rotulo: 'Ajustar meta', rota: '/orcamento' },
          }
        : {
            id: `meta-perto:${m.categoryId}`,
            tom: 'warn',
            titulo: `${nome} está em ${pct}% da meta`,
            texto: `${e.moeda(m.spent)} de ${e.moeda(m.limitCents)}, ${
              e.daysLeft === 0
                ? 'no último dia do mês'
                : e.daysLeft === 1
                  ? 'faltando 1 dia'
                  : `faltando ${e.daysLeft} dias`
            }.${x.texto}`,
            acao: { rotulo: 'Ajustar meta', rota: '/orcamento' },
          },
    );
  }

  const acima = acimas.find((a) => !usadas.has(a.categoryId));
  if (acima) {
    const x = extras(acima.categoryId, true);
    out.push({
      id: `acima:${acima.categoryId}`,
      tom: 'warn',
      titulo: `${e.nomeCategoria(acima.categoryId)} está ${acima.pct}% acima da média`,
      texto: `${e.moeda(acima.spentCents)} contra ${e.moeda(acima.avgCents)} nos meses anteriores.${x.texto}`,
      acao: x.incomum
        ? verTransacao(x.incomum.txId)
        : { rotulo: 'Ajustar meta', rota: '/orcamento' },
    });
  }

  const incomum = incomuns.find(
    (i) => !i.categoryId || !usadas.has(i.categoryId),
  );
  if (incomum)
    out.push({
      id: `incomum:${incomum.date}:${incomum.description}`,
      tom: 'info',
      titulo: `Gasto fora do padrão: ${exibir(incomum)}`,
      texto: `${e.moeda(incomum.amountCents)}, cerca de ${incomum.times.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes o normal da categoria.`,
      acao: verTransacao(incomum.txId),
    });

  if (e.assinaturasId) {
    const nova = newSubscriptions(e.txs, e.assinaturasId, e.today)[0];
    if (nova)
      out.push({
        id: `assinatura:${nova.description}`,
        tom: 'info',
        titulo: `Assinatura nova de ${e.moeda(nova.amountCents)}`,
        texto: `${exibir(nova)} apareceu em ${nova.firstSeen.slice(8)}/${nova.firstSeen.slice(5, 7)}. Confirme se é sua.`,
        acao: verTransacao(nova.txId),
      });
  }

  const reajuste = repricedRecurrences(detectRecurrences(e.txs))[0];
  if (reajuste)
    out.push({
      id: `reajuste:${reajuste.description}:${reajuste.toCents}`,
      tom: 'info',
      titulo: `${nomeDeExibicao(reajuste.description)} subiu ${reajuste.pct.toLocaleString('pt-BR')}%`,
      texto: `De ${e.moeda(reajuste.fromCents)} para ${e.moeda(reajuste.toCents)} por mês.`,
      acao: { rotulo: 'Ver transações', rota: '/transacoes' },
    });

  return out.filter((a) => !e.dispensados?.has(a.id)).slice(0, e.max ?? MAX);
}

/** Nome do insight como o banco escreveu, sem "PIX - ENVIADO 09/10 11:59". */
function exibir(i: { description: string; nome?: string }): string {
  return i.nome ? nomeDeExibicao(i.nome) : i.description;
}

/** Com o id, leva direto ao lançamento; sem ele, à lista. */
function verTransacao(txId?: string): Alerta['acao'] {
  return txId
    ? {
        rotulo: 'Ver transação',
        rota: '/transacoes',
        queryParams: { tx: txId },
      }
    : { rotulo: 'Ver transações', rota: '/transacoes' };
}
