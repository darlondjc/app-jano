// Roda TypeScript com os aliases @jano/* do workspace (tsconfig.base.json).
process.env.TS_NODE_PROJECT ??= require('node:path').join(
  __dirname,
  '../../tsconfig.base.json',
);
require('@swc-node/register');
