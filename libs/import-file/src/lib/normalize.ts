/**
 * Descrição normalizada: sem acentos, maiúscula, sem ruído de banco (datas, códigos longos,
 * prefixos como "COMPRA CARTAO"). Usada em regras de categoria e na deduplicação.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(
      /^(COMPRA (COM )?CARTAO|COMPRA NO DEBITO|PAGAMENTO (COM )?CARTAO)\s+/,
      '',
    )
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
