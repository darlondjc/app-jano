// Gera CSS e TS a partir de libs/ui/tokens/tokens.json (fonte única do design system).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = 'libs/ui/tokens/tokens.json';
const outDir = 'libs/ui/src/styles';
const t = JSON.parse(readFileSync(src, 'utf8'));
// "{primary}" no JSON é referência a outro token: vira var(--primary) no CSS.
const ref = (v) => v.replace(/^\{([a-z0-9-]+)\}$/, 'var(--$1)');
const themed = (list, theme) =>
  list.map((x) => [
    x.name,
    ref(typeof x.value === 'string' ? x.value : x.value[theme]),
  ]);

const base = [
  ['font-sans', t.type.families.sans],
  ...t.spacing.tokens.map((x) => [x.name, x.value]),
  ...t.radius.tokens.map((x) => [x.name, x.value]),
];
const block = (sel, pairs) =>
  `${sel} {\n${pairs.map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}\n`;

const light = [
  ...themed(t.color.tokens, 'light'),
  ...themed(t.shadow.tokens, 'light'),
];
const dark = [
  ...themed(t.color.tokens, 'dark'),
  ...themed(t.shadow.tokens, 'dark'),
];
const onlyDiff = dark.filter(
  ([k, v]) => light.find(([lk]) => lk === k)?.[1] !== v,
);

const css =
  '/* GERADO por tools/build-tokens.mjs — não edite à mão. */\n' +
  block(':root', [...base, ...light]) +
  block(':root[data-theme="dark"]', onlyDiff) +
  `@media (prefers-color-scheme: dark) {\n${block(
    ':root:not([data-theme="light"])',
    onlyDiff,
  )
    .split('\n')
    .map((l) => (l ? '  ' + l : l))
    .join('\n')}}\n`;

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/tokens.css`, css);

const ts =
  '// GERADO por tools/build-tokens.mjs — não edite à mão.\n' +
  `export const JANO_TOKENS = ${JSON.stringify(
    { light: Object.fromEntries(light), dark: Object.fromEntries(dark) },
    null,
    2,
  )} as const;\n`;
writeFileSync(`${outDir}/tokens.ts`, ts);
console.log(
  `tokens: ${light.length} claro, ${onlyDiff.length} diferem no escuro`,
);
