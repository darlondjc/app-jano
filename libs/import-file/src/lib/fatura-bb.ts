import { parseAmountToCents } from './money';
import type { ParseResult, RawTransaction } from './types';

export interface FaturaMeta {
  /** Data de fechamento (AAAA-MM-DD). */
  closingDate: string | null;
  dueDate: string | null;
  /** Final do cartão principal. */
  cardLast4: string | null;
  /** "Total da Fatura", em centavos. */
  totalCents: number | null;
}

export interface FaturaHolder {
  name: string;
  last4: string;
  /** Subtotal impresso na fatura. */
  subtotalCents: number | null;
  /** Soma do que foi lido (gastos positivos, créditos negativos, sem o pagamento da fatura anterior). */
  parsedCents: number;
}

export interface FaturaResult extends ParseResult {
  meta: FaturaMeta;
  holders: FaturaHolder[];
  /** Avisos para a prévia (soma não bate, data de fechamento ausente...). */
  warnings: string[];
}

const KNOWN_COUNTRIES =
  'BR|US|CA|IE|GB|NL|DE|FR|PT|AR|CL|UY|ES|IT|SG|JP|CN|AU|MX|CH|SE';
const ROW = new RegExp(
  `^(\\d{2})/(\\d{2})\\s+(.+?)\\s+(?:(${KNOWN_COUNTRIES})\\s+)?R\\$\\s*(-?\\d{1,3}(?:\\.\\d{3})*,\\d{2})$`,
);
const HOLDER = /^(.+?)\s*\(Cart[aã]o\s+(\d{4})\)$/i;
const HEADING = /^[A-Za-zÀ-ÿ/ ]{3,40}$/;
const NOT_HEADING =
  /^(Data\s+Descri|P[aá]gina|Subtotal|Total|Lan[cç]amentos|SALDO)/i;
const PAYMENT = /\b(PGTO|PAGAMENTO|PAGTO)\b/i;

const toIso = (d: string): string =>
  `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

/** Reconhece uma fatura de cartão do Banco do Brasil (Ourocard) pelo texto. */
export function isFaturaBB(lines: string[]): boolean {
  return (
    lines.some((l) => /Lan[cç]amentos nesta fatura/i.test(l)) &&
    lines.some((l) => /Fatura fechada em/i.test(l))
  );
}

/** Ano de um "DD/MM" de compra: o mais recente que não passa da data de fechamento. */
export function inferYear(
  day: number,
  month: number,
  closingIso: string,
): number {
  const [cy, cm, cd] = closingIso.split('-').map(Number);
  return month > cm || (month === cm && day > cd) ? cy - 1 : cy;
}

/** Mapa dos grupos do BB para as nossas categorias (só quando a correspondência é clara). */
export function bankCategoryToName(heading: string | undefined): string | null {
  switch ((heading ?? '').trim().toLowerCase()) {
    case 'lazer':
      return 'Lazer';
    case 'restaurantes':
      return 'Restaurantes';
    case 'transporte':
      return 'Transporte';
    case 'vestuário':
    case 'vestuario':
      return 'Vestuário';
    case 'saúde':
    case 'saude':
      return 'Saúde';
    case 'supermercados':
      return 'Mercado';
    case 'educação':
    case 'educacao':
      return 'Educação';
    case 'viagens':
      return 'Viagens';
    default:
      return null;
  }
}

/**
 * Lê as linhas de texto de uma fatura do BB. Valida pelas somas: cada titular deve fechar
 * com o "Subtotal" impresso e o conjunto com o "Total da Fatura"; se não fechar, avisa.
 *
 * Regras de data: compra à vista usa a data da compra (ano deduzido pelo fechamento);
 * parcela usa a data de fechamento, porque é o mês em que o valor pesa no orçamento.
 * O pagamento da fatura anterior é marcado como transferência.
 */
export function parseFaturaBB(lines: string[]): FaturaResult {
  const result: FaturaResult = {
    transactions: [],
    errors: [],
    meta: {
      closingDate: null,
      dueDate: null,
      cardLast4: null,
      totalCents: null,
    },
    holders: [],
    warnings: [],
  };
  const { meta } = result;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const closing = /Fatura fechada em\s+(\d{2}\/\d{2}\/\d{4})/i.exec(l);
    if (closing) meta.closingDate = toIso(closing[1]);
    const last4 =
      /OUROCARD.*Final\s+(\d{4})/i.exec(l) ?? /\bFinal\s+(\d{4})\b/.exec(l);
    if (last4 && !meta.cardLast4) meta.cardLast4 = last4[1];
    if (/^\s*Vencimento\b/.test(l) && !meta.dueDate) {
      for (const next of lines.slice(i, i + 6)) {
        const d = /(\d{2}\/\d{2}\/\d{4})/.exec(next);
        if (d) {
          meta.dueDate = toIso(d[1]);
          break;
        }
      }
    }
    const total = /^Total da Fatura\s+R\$\s*(-?[\d.]+,\d{2})/i.exec(l);
    if (total) meta.totalCents = parseAmountToCents(total[1]);
  }

  if (!meta.closingDate) {
    result.warnings.push(
      'Não achei a data de fechamento da fatura; nada foi lido.',
    );
    return result;
  }

  const start = lines.findIndex((l) => /Lan[cç]amentos nesta fatura/i.test(l));
  let holder: FaturaHolder | null = null;
  let heading = '';

  lines.slice(start + 1).forEach((raw, offset) => {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) return;

    const h = HOLDER.exec(line);
    if (h) {
      holder = {
        name: h[1].trim(),
        last4: h[2],
        subtotalCents: null,
        parsedCents: 0,
      };
      result.holders.push(holder);
      heading = '';
      return;
    }
    const sub = /^Subtotal\s+R\$\s*(-?[\d.]+,\d{2})$/i.exec(line);
    if (sub && holder) {
      holder.subtotalCents = parseAmountToCents(sub[1]);
      return;
    }
    if (!holder || /^Total da Fatura/i.test(line)) return;

    const m = ROW.exec(line);
    if (m) {
      const [, dd, mm, descRaw, , valueRaw] = m;
      const pdfCents = parseAmountToCents(valueRaw);
      if (pdfCents === null) {
        result.errors.push({
          index: start + 1 + offset,
          reason: `Valor ilegível: ${valueRaw}`,
        });
        return;
      }
      const description = descRaw.replace(/\s+/g, ' ').trim();
      const part =
        /\bPARC\s+(\d{2})\/(\d{2})\b/.exec(description) ??
        /^ANTEC\s+(\d{2})\/(\d{2})-/.exec(description);
      const installment = part
        ? { n: Number(part[1]), total: Number(part[2]) }
        : undefined;
      const isPayment =
        /pagamentos/i.test(heading) &&
        pdfCents < 0 &&
        PAYMENT.test(description);

      const day = Number(dd);
      const month = Number(mm);
      const date = installment
        ? meta.closingDate!
        : `${inferYear(day, month, meta.closingDate!)}-${mm}-${dd}`;

      const tx: RawTransaction = {
        date,
        amountCents: -pdfCents,
        description,
        holder: holder.last4,
      };
      if (installment) tx.installment = installment;
      if (heading && !/pagamentos|lan[cç]amentos|parcelad/i.test(heading))
        tx.bankCategory = heading;
      if (isPayment) tx.isTransfer = true;
      result.transactions.push(tx);
      if (!isPayment) holder.parsedCents += pdfCents;
      return;
    }

    if (/^\d{2}\/\d{2}\s/.test(line)) {
      result.errors.push({
        index: start + 1 + offset,
        reason: `Linha não reconhecida: ${line.slice(0, 60)}`,
      });
      return;
    }
    if (/^SALDO FATURA ANTERIOR/i.test(line)) return;
    if (HEADING.test(line) && !NOT_HEADING.test(line)) heading = line;
  });

  for (const h of result.holders) {
    if (h.subtotalCents !== null && h.subtotalCents !== h.parsedCents) {
      result.warnings.push(
        `A soma do cartão final ${h.last4} não fecha com o subtotal da fatura (lido ${h.parsedCents / 100}, fatura ${h.subtotalCents / 100}).`,
      );
    }
  }
  if (meta.totalCents !== null && result.holders.length) {
    const sum = result.holders.reduce((s, h) => s + h.parsedCents, 0);
    if (sum !== meta.totalCents) {
      result.warnings.push(
        `A soma geral não fecha com o total da fatura (lido ${sum / 100}, fatura ${meta.totalCents / 100}).`,
      );
    }
  }
  return result;
}
