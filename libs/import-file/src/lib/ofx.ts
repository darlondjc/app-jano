import { parseAmountToCents } from './money';
import type { ParseResult, RawTransaction } from './types';

/**
 * Lê OFX v1 (SGML, tags sem fechamento) e v2 (XML). Serve para conta corrente
 * (BANKTRANLIST) e cartão (CREDITCARDMSGSRSV1): ambos usam <STMTTRN>.
 * Recebe texto já decodificado; use `decodeBytes` para os bytes do arquivo.
 */
export function parseOfx(text: string): ParseResult {
  const result: ParseResult = { transactions: [], errors: [] };
  const blocks = splitBlocks(text);
  blocks.forEach((block, index) => {
    const date = parseOfxDate(field(block, 'DTPOSTED'));
    const amount = parseAmountToCents(field(block, 'TRNAMT') ?? '');
    const name = field(block, 'NAME');
    const memo = field(block, 'MEMO');
    if (!date)
      return result.errors.push({
        index,
        reason: 'Data inválida ou ausente (DTPOSTED).',
      });
    if (amount === null)
      return result.errors.push({
        index,
        reason: 'Valor inválido ou ausente (TRNAMT).',
      });
    const description = (memo && memo !== name ? [name, memo] : [name])
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tx: RawTransaction = {
      date,
      amountCents: amount,
      description: description || '(sem descrição)',
    };
    const fitid = field(block, 'FITID');
    if (fitid) tx.externalId = fitid;
    result.transactions.push(tx);
  });
  return result;
}

/** Decodifica bytes de um OFX respeitando CHARSET/ENCODING; padrão do BB: Windows-1252. */
export function decodeBytes(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 600));
  const utf8 = /ENCODING:UTF-8|CHARSET:(?:UTF-8|65001)/i.test(head);
  if (utf8) return new TextDecoder('utf-8').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function splitBlocks(text: string): string[] {
  const out: string[] = [];
  const open = /<STMTTRN>/gi;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = open.exec(text))) starts.push(m.index + m[0].length);
  starts.forEach((start, i) => {
    const rest = text.slice(start, starts[i + 1] ?? text.length);
    const end = rest.search(
      /<\/STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>/i,
    );
    out.push(end === -1 ? rest : rest.slice(0, end));
  });
  return out;
}

/** Valor de uma tag, em SGML (até a quebra de linha ou a próxima tag) ou XML (até o fechamento). */
function field(block: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  const v = m?.[1]?.trim();
  return v ? decodeEntities(v) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** "20261022120000[-3:BRT]" → "2026-10-22". Ignora hora e fuso para não mudar o dia. */
export function parseOfxDate(raw: string | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
