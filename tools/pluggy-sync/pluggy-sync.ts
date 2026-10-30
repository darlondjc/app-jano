/**
 * Sincroniza suas contas do Open Finance (Meu Pluggy) com o Jano. Uso pessoal, roda na sua
 * máquina: o clientSecret da Pluggy e a chave de serviço do Firebase nunca vão para o app.
 *
 *   npm run pluggy -- contas                 lista as contas da Pluggy e do Jano
 *   npm run pluggy -- sync [--desde AAAA-MM-DD] [--ate AAAA-MM-DD] [--seco]
 *
 * Configuração em tools/pluggy-sync/README.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { addDedupeKeys, hashKey, planImport } from '@jano/import-file';
import {
  PluggyClient,
  PluggyConnector,
  categorizar,
  type CategoriaRef,
  type RegraRef,
} from '@jano/open-finance';

const BATCH_LIMIT = 400; // Firestore aceita 500 operações por lote.
const DIAS_PADRAO = 30;

interface Config {
  /** Seu uid no Firebase Auth (Authentication → Users no console). */
  uid: string;
  /** Conexões do Meu Pluggy, uma por banco. */
  itemIds: string[];
  /** Conta da Pluggy → conta do Jano. Contas fora do mapa são ignoradas. */
  contas: Record<string, string>;
  /** Nada antes desta data (AAAA-MM-DD): evita duplicar o que já veio por arquivo. */
  inicio?: string;
}

function lerConfig(): Config {
  const file = join(__dirname, '../../pluggy.config.json');
  let config: Config;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(
      'Crie pluggy.config.json na raiz (modelo em tools/pluggy-sync/pluggy.config.example.json).',
    );
  }
  if (!config.uid || !config.itemIds?.length)
    throw new Error('pluggy.config.json precisa de "uid" e "itemIds".');
  return { ...config, contas: config.contas ?? {} };
}

function env(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Defina ${nome} (veja .env.pluggy no README).`);
  return v;
}

/** Data de hoje (ou `dias` atrás) em São Paulo, AAAA-MM-DD. */
function dataSp(diasAtras = 0): string {
  const d = new Date(Date.now() - diasAtras * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function opcao(args: string[], nome: string): string | undefined {
  const i = args.indexOf(nome);
  const v = i === -1 ? undefined : args[i + 1];
  if (v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new Error(`${nome} espera AAAA-MM-DD.`);
  return v;
}

async function lerColecao<T>(db: Firestore, path: string): Promise<T[]> {
  const snap = await db.collection(path).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

async function contas(
  connector: PluggyConnector,
  db: Firestore,
  config: Config,
): Promise<void> {
  const pluggy = await connector.listAccounts();
  const jano = await lerColecao<{ id: string; nickname: string; type: string }>(
    db,
    `users/${config.uid}/accounts`,
  );
  console.log('Contas na Pluggy:');
  for (const a of pluggy) {
    const destino = config.contas[a.externalId];
    console.log(
      `  ${a.externalId}  ${a.kind.padEnd(6)} ${a.name}${a.number ? ` (${a.number})` : ''}` +
        (a.detail ? ` [${a.detail}]` : '') +
        (destino ? `  → ${destino}` : '  (sem mapeamento)'),
    );
  }
  console.log('\nContas no Jano:');
  for (const c of jano)
    console.log(`  ${c.id}  ${c.type.padEnd(6)} ${c.nickname}`);
  console.log('\nLigue umas às outras em "contas" no pluggy.config.json.');
}

async function sync(
  connector: PluggyConnector,
  db: Firestore,
  config: Config,
  args: string[],
): Promise<void> {
  const seco = args.includes('--seco');
  let desde = opcao(args, '--desde') ?? dataSp(DIAS_PADRAO);
  const ate = opcao(args, '--ate') ?? dataSp();
  if (config.inicio && desde < config.inicio) desde = config.inicio;
  if (desde > ate) throw new Error(`Período vazio: ${desde} a ${ate}.`);

  const base = `users/${config.uid}`;
  const [contasJano, categorias, regras] = await Promise.all([
    lerColecao<{ id: string }>(db, `${base}/accounts`),
    lerColecao<CategoriaRef>(db, `${base}/categories`),
    lerColecao<RegraRef>(db, `${base}/rules`),
  ]);
  const idsJano = new Set(contasJano.map((c) => c.id));
  // Confere o mapeamento antes de gravar qualquer coisa.
  for (const accountId of Object.values(config.contas))
    if (!idsJano.has(accountId))
      throw new Error(
        `Conta "${accountId}" não existe no Jano (veja "contas").`,
      );

  console.log(
    `Período: ${desde} a ${ate}${seco ? ' (simulação, nada é gravado)' : ''}`,
  );
  for (const account of await connector.listAccounts()) {
    const accountId = config.contas[account.externalId];
    if (!accountId) {
      console.log(`- ${account.name}: sem mapeamento, ignorada.`);
      continue;
    }

    const raw = await connector.fetchTransactions(account, {
      from: desde,
      to: ate,
    });
    // As duplicatas só são buscadas no período; algo fora dele seria regravado.
    const noPeriodo = raw.filter((t) => t.date >= desde && t.date <= ate);
    const keyed = addDedupeKeys(accountId, noPeriodo);
    const snap = await db
      .collection(`${base}/transactions`)
      .where('date', '>=', desde)
      .where('date', '<=', ate)
      .get();
    const plan = planImport(
      keyed,
      new Set(snap.docs.map((d) => d.get('dedupeKey') as string)),
    );
    const rows = categorizar(plan.fresh, categorias, regras);
    const semCategoria = rows.filter(
      (r) => !r.categoryId && !r.tx.isTransfer,
    ).length;
    console.log(
      `- ${account.name} → ${accountId}: ${rows.length} novas, ` +
        `${plan.duplicates.length} já existiam, ${semCategoria} sem categoria.`,
    );
    if (seco) continue;

    const importId = crypto.randomUUID();
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const { tx, categoryId } of rows.slice(i, i + BATCH_LIMIT)) {
        // Mesmo formato de TransactionsRepository.commitImport.
        batch.set(
          db.doc(`${base}/transactions/${await hashKey(tx.dedupeKey)}`),
          {
            accountId,
            date: tx.date,
            amountCents: tx.amountCents,
            description: tx.description,
            descriptionNorm: tx.descriptionNorm,
            dedupeKey: tx.dedupeKey,
            categoryId,
            categoryIsManual: false,
            isTransfer: tx.isTransfer ?? false,
            importId,
            ...(tx.holder ? { holder: tx.holder } : {}),
            ...(tx.installment ? { installment: tx.installment } : {}),
          },
        );
      }
      await batch.commit();
    }
    // Registro de importação: alimenta o lembrete do Início mesmo quando nada era novo.
    await db.doc(`${base}/imports/${importId}`).set({
      accountId,
      fileName: `Open Finance: ${account.name}`,
      added: rows.length,
      duplicates: plan.duplicates.length,
      errors: 0,
      createdAt: new Date().toISOString(),
    });
  }
}

async function main(): Promise<void> {
  const [comando, ...args] = process.argv.slice(2);
  if (comando !== 'contas' && comando !== 'sync') {
    console.log(
      'Uso: npm run pluggy -- contas | sync [--desde AAAA-MM-DD] [--ate AAAA-MM-DD] [--seco]',
    );
    process.exitCode = 1;
    return;
  }
  const config = lerConfig();
  const client = new PluggyClient({
    clientId: env('PLUGGY_CLIENT_ID'),
    clientSecret: env('PLUGGY_CLIENT_SECRET'),
  });
  const connector = new PluggyConnector(client, config.itemIds);
  env('GOOGLE_APPLICATION_CREDENTIALS');
  const db = getFirestore(initializeApp({ credential: applicationDefault() }));

  if (comando === 'contas') await contas(connector, db, config);
  else await sync(connector, db, config, args);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
