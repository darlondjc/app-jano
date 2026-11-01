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

/** Palavras que ficam minúsculas no meio do nome. */
const MINUSCULAS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'na',
  'no',
]);
/** Siglas que ficam como estão. */
const SIGLAS = new Set([
  'BB',
  'CEF',
  'SA',
  'S/A',
  'ME',
  'MEI',
  'EPP',
  'TV',
  'IPVA',
  'IPTU',
  'INSS',
  'FGTS',
  'DARF',
  'GPS',
  'CPF',
  'CNPJ',
]);

function titulo(nome: string): string {
  // Só mexe no que veio todo em maiúsculas; um nome que já tem minúsculas foi escrito assim.
  if (/[a-zà-ú]/.test(nome)) return nome;
  return nome
    .toLowerCase()
    .split(' ')
    .map((p, i) => {
      if (SIGLAS.has(p.toUpperCase())) return p.toUpperCase();
      if (i > 0 && MINUSCULAS.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

/**
 * Nome para as listas: sem prefixo de operação, data e hora, sem código de loja no fim
 * ("DROGASIL 1234"), sem o "*" das maquininhas ("IFOOD *RESTAURANTE") e com maiúsculas só
 * no começo das palavras. A descrição original continua no detalhe do lançamento.
 */
export function nomeDeExibicao(description: string): string {
  const limpo = nomeSemPrefixo(description)
    .replace(/\s*\*\s*/g, ' ')
    .replace(/(\s+\d{3,})+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return titulo(limpo || description.trim());
}

/** Tipo da operação, para o detalhe da linha: "Pix enviado", "Débito"... null se não houver. */
export function tipoDeOperacao(description: string): string | null {
  const d = description.toUpperCase();
  if (/^PIX\s*-\s*ENVIADO/.test(d)) return 'Pix enviado';
  if (/^PIX\s*-\s*RECEBIDO/.test(d)) return 'Pix recebido';
  if (/^(COMPRA (C\/|COM )?CARTAO|COMPRA NO DEBITO)/.test(d)) return 'Débito';
  return null;
}
