import { calendarioPeloSalario, type CalendarioFinanceiro } from '@jano/engine';
import { estabelecimento, nomeDeExibicao } from '@jano/import-file';
import { series } from '../projecoes/plano';
import type { TxRec } from '../recorrencias/linhas';

/** Entrada recorrente abaixo disso não é salário (rendimento, reembolso). */
const SALARIO_MINIMO = 50_000;
/** Variação aceita entre um salário e outro (horas extras, descontos). */
const VARIACAO = 0.3;

/**
 * O salário é a maior entrada que se repete todo mês nas contas (fora o cartão). Devolve as
 * datas em que ele caiu de fato e o dia de costume; `null` sem salário reconhecível.
 */
export function detectarSalario(
  txs: (TxRec & { accountId: string })[],
  cartoes: ReadonlySet<string>,
): { chegadas: string[]; dia: number; nome: string } | null {
  const contas = txs.filter((t) => !cartoes.has(t.accountId));
  const salario = series(contas, 'entrada')
    .map(({ s }) => s)
    .filter((s) => s.amountCents >= SALARIO_MINIMO)
    .sort((a, b) => b.amountCents - a.amountCents)[0];
  if (!salario) return null;
  const chegadas = contas
    .filter(
      (t) =>
        !t.isTransfer &&
        t.amountCents > 0 &&
        estabelecimento(t.descriptionNorm) === salario.description &&
        Math.abs(t.amountCents - salario.amountCents) <=
          salario.amountCents * VARIACAO,
    )
    .map((t) => t.date);
  const ultima = contas
    .filter((t) => estabelecimento(t.descriptionNorm) === salario.description)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    chegadas,
    dia: salario.day,
    nome: nomeDeExibicao(ultima?.description ?? salario.description),
  };
}

/** Calendário financeiro pelo salário detectado; `null` deixa o mês do calendário. */
export function calendarioDoHistorico(
  txs: (TxRec & { accountId: string })[],
  cartoes: ReadonlySet<string>,
): { calendario: CalendarioFinanceiro; nome: string; dia: number } | null {
  const s = detectarSalario(txs, cartoes);
  return s
    ? {
        calendario: calendarioPeloSalario(s.chegadas, s.dia),
        nome: s.nome,
        dia: s.dia,
      }
    : null;
}
