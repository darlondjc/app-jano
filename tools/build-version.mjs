#!/usr/bin/env node
// Gera o identificador da versão publicada: o bundle embute o BUILD_ID e o servidor
// expõe o mesmo em /version.json; quando divergem, o app oferece "Atualizar".
import { readFileSync, writeFileSync } from 'node:fs';

const changelog = readFileSync('apps/web/src/app/versao/changelog.ts', 'utf8');
const version = /version:\s*'(\d+\.\d+\.\d+)'/.exec(changelog)?.[1];
if (!version) throw new Error('Versão não encontrada em changelog.ts');
const buildId = (process.env.GITHUB_SHA ?? String(Date.now())).slice(0, 12);
// Principal novidade (primeiro item da versão atual), para o aviso de atualização.
const novidade = /texto:\s*'((?:[^'\\]|\\.)*)'/
  .exec(changelog)?.[1]
  ?.replace(/\\'/g, "'");

writeFileSync(
  'apps/web/src/environments/build-info.ts',
  `// Gerado em CI por tools/build-version.mjs. Em desenvolvimento fica "dev" e o aviso de atualização não aparece.\nexport const BUILD_ID = '${buildId}' as string;\n`,
);
writeFileSync(
  'apps/web/public/version.json',
  JSON.stringify({
    version,
    buildId,
    builtAt: new Date().toISOString(),
    ...(novidade ? { novidade } : {}),
  }) + '\n',
);
console.log(`versão ${version}, build ${buildId}`);
