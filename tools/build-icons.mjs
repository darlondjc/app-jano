// Gera os ícones do app instalado (PWA e iOS) a partir do desenho de
// docs/design/design-system/project/assets/Logos/jano-icone-app.svg.
// Precisa do Playwright com Chromium: npx -p playwright node tools/build-icons.mjs
//
// A chave fica menor que no SVG oficial (escala 0.92): no ícone instalado ela parecia
// grande demais. A versão maskable é ainda menor porque o Android recorta o ícone em
// círculo e só garante o miolo (80% do lado).
import { chromium } from 'playwright';

const VERDE = '#0E7C6B';
const ESCALA = 0.76;
const ESCALA_MASKABLE = 0.62;

const svg = ({ escala, cantos }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">` +
  `<rect width="56" height="56" rx="${cantos}" fill="${VERDE}"/>` +
  `<g transform="translate(28 28) rotate(45) scale(${escala}) translate(-32 -32)">` +
  `<circle cx="32" cy="15" r="9" fill="none" stroke="#FFFFFF" stroke-width="6"/>` +
  `<path d="M32 24 V58 M32 42 H19 M32 52 H25 M32 42 H45 M32 52 H39" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>` +
  `</g></svg>`;

// Cantos arredondados só onde o sistema não recorta sozinho; iOS e maskable recebem quadrado.
const icones = [
  { arquivo: 'icon-192.png', lado: 192, escala: ESCALA, cantos: 13 },
  { arquivo: 'icon-512.png', lado: 512, escala: ESCALA, cantos: 13 },
  { arquivo: 'apple-touch-icon.png', lado: 180, escala: ESCALA, cantos: 0 },
  {
    arquivo: 'icon-maskable-512.png',
    lado: 512,
    escala: ESCALA_MASKABLE,
    cantos: 0,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { arquivo, lado, ...desenho } of icones) {
  await page.setViewportSize({ width: lado, height: lado });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg(desenho)}`,
  );
  await page.screenshot({
    path: `apps/web/public/icons/${arquivo}`,
    omitBackground: true,
  });
  console.log(arquivo);
}
await browser.close();
