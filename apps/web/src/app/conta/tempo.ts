/** Dias inteiros desde um instante ISO (0 = hoje; nunca negativo). */
export function diasDesde(iso: string, agora = new Date()): number {
  return Math.max(
    0,
    Math.floor((agora.getTime() - new Date(iso).getTime()) / 86_400_000),
  );
}

/** "hoje", "ontem" ou "há N dias", a partir de um instante ISO. */
export function haQuantoTempo(iso: string, agora = new Date()): string {
  const dias = diasDesde(iso, agora);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

const diaSp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
});
const horaSp = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});
const dataSp = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});

/** "hoje, 07:34", "ontem, 22:10" ou "02/11, 07:34", no fuso de São Paulo. */
export function diaEHora(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = diaSp.format(d);
  const hoje = diaSp.format(agora);
  const ontem = diaSp.format(new Date(agora.getTime() - 86_400_000));
  const rotulo =
    dia === hoje ? 'hoje' : dia === ontem ? 'ontem' : dataSp.format(d);
  return `${rotulo}, ${horaSp.format(d)}`;
}
