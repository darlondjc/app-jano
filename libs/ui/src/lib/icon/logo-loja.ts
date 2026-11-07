import { LOGOS_LOJAS, type LogoLoja } from './logos-lojas';

const normalizar = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()} `;

/**
 * Logo da loja pela descrição do lançamento ("NETFLIX.COM", "APPLE.COM/BILL", "Uber Trip"),
 * por palavra inteira: "UBER" casa com "UBER TRIP", não com "UBERLANDIA".
 */
export function logoDaLoja(
  ...textos: (string | null | undefined)[]
): LogoLoja | null {
  const t = normalizar(textos.filter(Boolean).join(' '));
  if (t.trim() === '') return null;
  return (
    LOGOS_LOJAS.find((l) => l.padroes.some((p) => t.includes(` ${p} `))) ?? null
  );
}

/** Desenho claro em marcas escuras e escuro nas claras (amarelo do McDonald's). */
export function corDoDesenho(fundo: string): string {
  const n = parseInt(fundo.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#111' : '#fff';
}
