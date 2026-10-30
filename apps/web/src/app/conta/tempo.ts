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
