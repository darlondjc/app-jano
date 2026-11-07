import type { PluggyItem } from './pluggy-client';

const hora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Uma linha de log por conexão: estado e quando o Meu Pluggy falou com o banco pela última
 * vez. Só metadados da conexão, nunca valores ou lançamentos (o log do Actions é público).
 * Ex.: "Conexão Banco do Brasil: UPDATED, banco consultado em 06/11 05:12 (há 2 h)."
 */
export function linhaDaConexao(item: PluggyItem, agora: Date): string {
  const nome = item.connector?.name ?? 'sem nome';
  const quando = item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : null;
  let consulta = 'banco ainda não consultado';
  if (quando && !Number.isNaN(quando.getTime())) {
    const horas = Math.max(
      0,
      Math.floor((agora.getTime() - quando.getTime()) / 3_600_000),
    );
    const ha =
      horas < 1
        ? 'há menos de 1 h'
        : horas < 48
          ? `há ${horas} h`
          : `há ${Math.floor(horas / 24)} dias`;
    consulta = `banco consultado em ${hora.format(quando).replace(',', '')} (${ha})`;
  }
  const erro = item.error?.code ? ` [${item.error.code}]` : '';
  return `Conexão ${nome}: ${item.status}${erro}, ${consulta}.`;
}
