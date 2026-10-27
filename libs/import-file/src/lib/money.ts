/**
 * Converte texto de valor em centavos inteiros, sem ponto flutuante.
 * Aceita "-1234.56", "1.234,56", "1234,5", "R$ 12,00", "(12,00)", "12,00-".
 *
 * Regras de separador:
 * - os dois presentes: o último é o decimal ("1.234,56" e "1,234.56");
 * - um só tipo, repetido: milhar ("1.234.567");
 * - um só tipo, uma vez, com exatamente 3 dígitos depois: milhar ("1.234");
 * - um só tipo, uma vez, nos demais casos: decimal ("12,5", "1234.56").
 */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/R\$|\s/g, '');
  if (!s) return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sep = Math.max(lastComma, lastDot);
  let intPart = s;
  let decPart = '';
  if (sep !== -1) {
    const char = s[sep];
    const after = s.slice(sep + 1);
    const bothKinds = lastComma !== -1 && lastDot !== -1;
    const repeated = s.split(char).length - 1 > 1;
    const thousands = !bothKinds && (repeated || after.length === 3);
    if (!thousands) {
      intPart = s.slice(0, sep);
      decPart = after;
    }
    intPart = intPart.replace(/[.,]/g, '');
  }
  if (
    !/^\d*$/.test(intPart) ||
    !/^\d*$/.test(decPart) ||
    (intPart === '' && decPart === '')
  ) {
    return null;
  }
  const cents =
    Number(intPart || '0') * 100 + Number((decPart + '00').slice(0, 2));
  return negative ? -cents : cents;
}
