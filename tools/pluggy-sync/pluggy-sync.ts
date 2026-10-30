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
  type ConnectedAccount,
  type RegraRef,
} from '@jano/open-finance';

const BATCH_LIMIT = 400; // Firestore aceita 500 operações por lote.
/**
 * Janela padrão. O cartão manda; a conta corrente cabe folgada nela: as compras do cartão só
 * chegam quando a fatura fecha (uns 30 dias de compras de uma vez, com a data original) e o
 * Meu Pluggy atualiza uma vez por dia. 45 dias cobrem o ciclo inteiro com folga para alguns
 * dias de banco fora do ar. O que já foi gravado é pulado, então a sobreposição não custa nada.
 */
const DIAS_PADRAO = 45;

interface Config {
  /** Seu uid no Firebase Auth (Authentication → Users no console). */
  uid: string;
  /** Conexões do Meu Pluggy, uma por banco. */
  itemIds: string[];
  /** Conta da Pluggy → conta do Jano. Contas fora do mapa são ignoradas. */
  contas: Record<string, string>;
  /**
   * Nada antes desta data (AAAA-MM-DD): evita duplicar o que já veio por arquivo. Uma data
   * para todas as contas ou uma por conta do Jano, ex.: { "conta-corrente": "2026-10-28" }.
   */
  inicio?: string | Record<string, string>;
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
  const inicios =
    typeof config.inicio === 'string'
      ? [config.inicio]
      : Object.values(config.inicio ?? {});
  for (const d of inicios)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
      throw new Error(`"inicio" espera AAAA-MM-DD, veio "${d}".`);
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
  const janela = opcao(args, '--desde') ?? dataSp(DIAS_PADRAO);
  const ate = opcao(args, '--ate') ?? dataSp();
  if (janela > ate) throw new Error(`Período vazio: ${janela} a ${ate}.`);

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
    `Período: ${janela} a ${ate}${seco ? ' (simulação, nada é gravado)' : ''}`,
  );
  const contasPluggy = await connector.listAccounts();
  for (const account of contasPluggy) {
    const accountId = config.contas[account.externalId];
    if (!accountId) {
      console.log(`- ${account.name}: sem mapeamento, ignorada.`);
      continue;
    }
    const inicio =
      typeof config.inicio === 'string'
        ? config.inicio
        : config.inicio?.[accountId];
    const desde = inicio && inicio > janela ? inicio : janela;
    if (desde > ate) {
      console.log(`- ${account.name} → ${accountId}: começa em ${inicio}.`);
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
      `- ${account.name} → ${accountId}${desde > janela ? ` (desde ${desde})` : ''}: ` +
        `${rows.length} novas, ` +
        `${plan.duplicates.length} já existiam, ${semCategoria} sem categoria.`,
    );
    if (seco) {
      // Na simulação, mostra cada lançamento para conferir antes de gravar.
      for (const { tx, categoryId } of rows) {
        const valor = (tx.amountCents / 100).toFixed(2).replace('.', ',');
        const cat = tx.isTransfer ? 'transferência' : (categoryId ?? '—');
        console.log(
          `    ${tx.date}  ${valor.padStart(11)}  ${cat.padEnd(16)} ${tx.description}`,
        );
      }
      const semId = rows.filter((r) => !r.tx.externalId).length;
      if (semId)
        console.log(
          `    ${semId} sem id do banco (providerId): chave por data + valor + descrição.`,
        );
      continue;
    }

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
  if (!seco) await gravarSaldos(db, base, contasPluggy, config);
}

/**
 * Saldo de cada conta do banco, inclusive as sem mapeamento (a poupança entra no "Saldo
 * atual" do Início). Nunca vai para o log: no GitHub Actions ele é público.
 */
async function gravarSaldos(
  db: Firestore,
  base: string,
  contas: ConnectedAccount[],
  config: Config,
): Promise<void> {
  const col = db.collection(`${base}/balances`);
  const batch = db.batch();
  const ids = new Set<string>();
  const syncedAt = new Date().toISOString();
  for (const a of contas) {
    if (a.balanceCents === undefined) continue;
    ids.add(a.externalId);
    batch.set(col.doc(a.externalId), {
      name: a.name,
      kind: a.kind,
      detail: a.detail ?? null,
      number: a.number ?? null,
      accountId: config.contas[a.externalId] ?? null,
      balanceCents: a.balanceCents,
      bankUpdatedAt: a.updatedAt ?? null,
      syncedAt,
    });
  }
  // Reconectar o banco troca os ids das contas: some com o saldo das que não existem mais.
  for (const d of (await col.get()).docs)
    if (!ids.has(d.id)) batch.delete(d.ref);
  await batch.commit();
  console.log(`Saldos atualizados: ${ids.size} contas.`);
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
