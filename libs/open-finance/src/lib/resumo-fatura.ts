import { nomeSemPrefixo } from '@jano/import-file';
import type { ResumoFatura } from './bank-connector';
import type { LancamentoPronto } from './categorizar';

/** Quantas compras grandes guardar no resumo. */
const MAIORES = 5;

/**
 * Resumo da fatura aberta a partir das compras do período (já categorizadas, com as regras do
 * usuário): total, por categoria e as maiores. Estornos abatem; pagamento da fatura e outras
 * transferências ficam de fora.
 */
export function resumirFatura(
  rows: LancamentoPronto[],
  desde: string,
): ResumoFatura {
  const compras = rows.filter((r) => !r.tx.isTransfer && r.tx.date >= desde);
  const porCategoria = new Map<string | null, number>();
  let totalCents = 0;
  for (const { tx, categoryId } of compras) {
    const cents = -tx.amountCents;
    totalCents += cents;
    porCategoria.set(categoryId, (porCategoria.get(categoryId) ?? 0) + cents);
  }
  return {
    desde,
    totalCents,
    compras: compras.filter((r) => r.tx.amountCents < 0).length,
    porCategoria: [...porCategoria]
      .map(([categoryId, cents]) => ({ categoryId, cents }))
      .filter((c) => c.cents > 0)
      .sort((a, b) => b.cents - a.cents),
    maiores: compras
      .filter((r) => r.tx.amountCents < 0)
      .sort((a, b) => a.tx.amountCents - b.tx.amountCents)
      .slice(0, MAIORES)
      .map(({ tx, categoryId }) => ({
        nome: nomeSemPrefixo(tx.description),
        cents: -tx.amountCents,
        date: tx.date,
        categoryId,
      })),
  };
}

/**
 * Primeiro dia da fatura aberta. Com a data de fechamento do banco: se já fechou, o dia
 * seguinte; se ainda vai fechar, o dia seguinte ao fechamento do mês anterior. Sem ela, os
 * últimos 30 dias.
 */
export function inicioDaFaturaAberta(
  fechamento: string | null,
  hoje: string,
): string {
  const somar = (iso: string, meses: number, dias: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + meses);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  if (!fechamento) return somar(hoje, 0, -30);
  return fechamento < hoje ? somar(fechamento, 0, 1) : somar(fechamento, -1, 1);
}
