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

/**
 * Prefixos de operação que o banco põe antes do nome da loja, já normalizados. A compra no
 * débito do BB vem como "COMPRA C/CARTAO 27/10 17:15 LOJA": a data some na normalização, mas
 * "C/" e a hora ficam ("COMPRA C CARTAO 17 15 LOJA"). O PIX vem como "PIX - ENVIADO 14/10
 * 08:43 FULANO" ("PIX ENVIADO 08 43 FULANO").
 */
const PREFIXO_OPERACAO =
  /^(COMPRA (C |COM )?CARTAO|COMPRA NO DEBITO|PAGAMENTO (COM )?CARTAO|PIX (ENVIADO|RECEBIDO))( \d{2} \d{2}(?= ))?\s+/;

/**
 * Só o estabelecimento, sem o prefixo da operação nem a hora. Serve para agrupar compras da
 * mesma loja e propor regras; a `descriptionNorm` gravada não muda, porque é parte da chave de
 * deduplicação.
 */
export function estabelecimento(descriptionNorm: string): string {
  return (
    descriptionNorm.replace(PREFIXO_OPERACAO, '').trim() || descriptionNorm
  );
}

/**
 * Prefixo de operação, data e hora que o banco põe antes do nome, na descrição como veio
 * ("COMPRA C/CARTAO 30/10 14:26 MO A MO", "PIX - ENVIADO 30/10 11:59 Fulano").
 */
const PREFIXO_DO_BANCO =
  /^(COMPRA (C\/|COM )?CARTAO|COMPRA NO DEBITO|PAGAMENTO (COM )?CARTAO|PIX\s*-\s*(ENVIADO|RECEBIDO))\s+(\d{2}\/\d{2}(\/\d{2,4})?\s+)?(\d{2}:\d{2}\s+)?/i;

/** Nome para exibir: a descrição como veio, sem o prefixo da operação, a data e a hora. */
export function nomeSemPrefixo(description: string): string {
  return description.replace(PREFIXO_DO_BANCO, '').trim() || description;
}
