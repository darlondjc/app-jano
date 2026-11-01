import {
  detectRecurrences,
  proximaCobranca,
  type RecurringSeries,
} from '@jano/engine';
import { estabelecimento, nomeDeExibicao } from '@jano/import-file';
import {
  jaVeioNoMes,
  podeGastar,
  type PodeGastar,
} from '../inicio/pode-gastar';
import {
  fixasPorMes,
  montarRecorrencias,
  parcelamentos,
  type TxRec,
} from '../recorrencias/linhas';

export interface EventoPlano {
  /** AAAA-MM-DD; null quando a data não é conhecida (fatura sem pagamento anterior). */
  data: string | null;
  nome: string;
  sub: string;
  /** Com sinal: entrada positiva, saída negativa. */
  cents: number;
  /** Saldo das contas depois do evento; null sem saldo do banco. */
  saldoDepois: number | null;
}

export interface MesComprometido {
  /** AAAA-MM */
  mes: string;
  fixasCents: number;
  parcelasCents: number;
  /** (fixas + parcelas) sobre a renda recorrente; null sem renda conhecida. */
  pct: number | null;
}

export interface PlanoDoMes {
  gastar: PodeGastar | null;
  eventos: EventoPlano[];
  rendaCents: number;
  comprometido: MesComprometido[];
}

export interface EntradaPlano {
  /** Saldo das contas no banco; null sem Open Finance. */
  saldoCents: number | null;
  /** Fatura em aberto dos cartões (positivo = devido). */
  faturaCents: number;
  txs: (TxRec & { accountId: string })[];
  cartoes: ReadonlySet<string>;
  /** AAAA-MM-DD */
  hoje: string;
  dias?: number;
  meses?: number;
}

const somarDias = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const somarMeses = (mes: string, n: number): string => {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Pagamento de fatura no extrato da conta (marcado como transferência). */
export const PAGAMENTO_FATURA = /\b(PAGTO|PAGAMENTO) (DE )?(CARTAO|FATURA)\b/;

/** Dia em que a fatura costuma ser paga, pela mediana dos últimos pagamentos. */
export function diaDaFatura(contas: TxRec[]): number | null {
  const dias = contas
    .filter(
      (t) =>
        t.isTransfer &&
        t.amountCents < 0 &&
        PAGAMENTO_FATURA.test(t.descriptionNorm),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((t) => Number(t.date.slice(8, 10)))
    .sort((a, b) => a - b);
  return dias.length ? dias[Math.floor(dias.length / 2)] : null;
}

/** Próxima data da série que ainda não aconteceu neste mês. */
function proxima(s: RecurringSeries, txs: TxRec[], hoje: string): string {
  const data = proximaCobranca(s.day, hoje);
  if (data.slice(0, 7) !== hoje.slice(0, 7) || !jaVeioNoMes(s, txs, hoje))
    return data;
  return proximaCobranca(s.day, `${somarMeses(hoje.slice(0, 7), 1)}-01`);
}

/** Séries de valor fixo (até 2% de variação): assinaturas e seguros, não consumo. */
export function cobrancasFixas<T extends { s: RecurringSeries }>(
  lista: T[],
): T[] {
  return lista.filter(
    ({ s }) =>
      Math.abs(s.amountCents - s.previousCents) <= s.previousCents * 0.02,
  );
}

/** Séries agrupadas pela loja (sem prefixo nem hora), com o nome da última ocorrência. */
export function series(txs: TxRec[], tipo: 'gasto' | 'entrada') {
  const porLoja = txs.map((t) => ({
    ...t,
    descriptionNorm: estabelecimento(t.descriptionNorm),
  }));
  const ultimo = new Map<string, TxRec>();
  for (const t of [...porLoja].sort((a, b) => a.date.localeCompare(b.date)))
    ultimo.set(t.descriptionNorm, t);
  return detectRecurrences(porLoja, tipo).map((s) => ({
    s,
    nome: nomeDeExibicao(
      ultimo.get(s.description)?.description ?? s.description,
    ),
  }));
}

/**
 * O plano do mês: quanto dá para gastar até o salário, o que entra e sai nos próximos dias
 * (com o saldo previsto depois de cada evento) e quanto da renda dos próximos meses já está
 * comprometido com contas fixas e parcelas.
 */
export function planoDoMes(e: EntradaPlano): PlanoDoMes {
  const dias = e.dias ?? 30;
  const meses = e.meses ?? 4;
  const contas = e.txs.filter((t) => !e.cartoes.has(t.accountId));
  const semParcelas = e.txs.filter((t) => !t.installment);
  const ate = somarDias(e.hoje, dias);

  const entradas = series(contas, 'entrada');
  const fixasDaConta = series(
    contas.filter((t) => !t.installment),
    'gasto',
  );
  const eventos: EventoPlano[] = [];
  for (const { s, nome } of entradas) {
    const data = proxima(s, contas, e.hoje);
    if (data < ate)
      eventos.push({
        data,
        nome,
        sub: 'entrada recorrente',
        cents: s.amountCents,
        saldoDepois: null,
      });
  }
  for (const { s, nome } of fixasDaConta) {
    const data = proxima(s, contas, e.hoje);
    if (data < ate)
      eventos.push({
        data,
        nome,
        sub: 'conta fixa',
        cents: -s.amountCents,
        saldoDepois: null,
      });
  }
  if (e.faturaCents > 0) {
    const dia = diaDaFatura(contas);
    const data = dia === null ? null : proximaCobranca(dia, e.hoje);
    if (data === null || data < ate)
      eventos.push({
        data,
        nome: 'Fatura do cartão',
        sub:
          data === null
            ? 'em aberto · vencimento não identificado'
            : 'em aberto',
        cents: -e.faturaCents,
        saldoDepois: null,
      });
  }
  eventos.sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  if (e.saldoCents !== null) {
    let saldo = e.saldoCents;
    for (const ev of eventos) {
      saldo += ev.cents;
      ev.saldoDepois = saldo;
    }
  }

  const rendaCents = entradas.reduce((t, { s }) => t + s.amountCents, 0);
  // Mesma regra de Recorrências: o que sai das contas todo mês e, do cartão, só o que tem
  // valor fixo (assinaturas); gasto variável que se repete no cartão não é compromisso.
  const fixasCents = fixasPorMes(
    montarRecorrencias(e.txs, e.hoje, 'assinaturas', e.cartoes),
  );
  const parcelas = parcelamentos(e.txs, e.hoje);
  const comprometido: MesComprometido[] = [];
  for (let i = 1; i <= meses; i++) {
    const parcelasCents = parcelas
      .filter((p) => (p.parcela?.faltam ?? 0) >= i)
      .reduce((t, p) => t + p.cents, 0);
    comprometido.push({
      mes: somarMeses(e.hoje.slice(0, 7), i),
      fixasCents,
      parcelasCents,
      pct:
        rendaCents > 0
          ? Math.round(((fixasCents + parcelasCents) / rendaCents) * 100)
          : null,
    });
  }

  return {
    gastar:
      e.saldoCents === null
        ? null
        : podeGastar({
            saldoCents: e.saldoCents,
            faturaCents: e.faturaCents,
            txs: contas,
            hoje: e.hoje,
          }),
    eventos,
    rendaCents,
    comprometido,
  };
}
