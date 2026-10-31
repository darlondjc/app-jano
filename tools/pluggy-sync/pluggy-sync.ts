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
import {
  getFirestore,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { addDedupeKeys, hashKey, planImport } from '@jano/import-file';
import {
  PluggyClient,
  PluggyConnector,
  categorizar,
  inferirPeloHistorico,
  inicioDaFaturaAberta,
  resumirFatura,
  type ResumoFatura,
  type CategoriaRef,
  type LancamentoGravado,
  type LancamentoPronto,
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
  // Meses com lançamento novo ou alterado: o app relê só esses (ver gravarMesesAlterados).
  const alterados = new Set<string>();
  // Uma leitura só, da janela inteira: serve à deduplicação de todas as contas e à revisão
  // pela mesma loja. Nada antes da janela é lido nem alterado (cota do plano gratuito).
  const naJanela = await db
    .collection(`${base}/transactions`)
    .where('date', '>=', janela)
    .where('date', '<=', ate)
    .get();
  const chavesGravadas = new Set(
    naJanela.docs.map((d) => d.get('dedupeKey') as string),
  );
  const lancamentos = new Map(
    naJanela.docs.map((d) => [
      d.id,
      { id: d.id, ...d.data() } as LancamentoGravado & { date: string },
    ]),
  );
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
    const plan = planImport(keyed, chavesGravadas);
    const rows = categorizar(plan.fresh, categorias, regras);
    const semCategoria = rows.filter(
      (r) => !r.categoryId && !r.tx.isTransfer,
    ).length;
    const reavaliar = reavaliacoes(
      categorizar(plan.duplicates, categorias, regras),
      naJanela.docs,
    );
    for (const r of reavaliar) {
      const l = lancamentos.get(r.ref.id);
      if (l)
        Object.assign(l, {
          categoryId: r.categoryId,
          isTransfer: r.isTransfer,
        });
    }
    for (const { tx, categoryId } of rows) {
      alterados.add(tx.date.slice(0, 7));
      const id = await hashKey(tx.dedupeKey);
      lancamentos.set(id, {
        id,
        date: tx.date,
        descriptionNorm: tx.descriptionNorm,
        categoryId,
        categoryIsManual: false,
        isTransfer: tx.isTransfer ?? false,
      });
    }
    for (const r of reavaliar) alterados.add(r.date.slice(0, 7));
    console.log(
      `- ${account.name} → ${accountId}${desde > janela ? ` (desde ${desde})` : ''}: ` +
        `${rows.length} novas, ` +
        `${plan.duplicates.length} já existiam, ${semCategoria} sem categoria, ` +
        `${reavaliar.length} categorizadas agora.`,
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
      const comSugestao = keyed.filter((t) => t.suggestedCategory).length;
      console.log(
        `    ${comSugestao} de ${keyed.length} com categoria sugerida pela Pluggy ou pelo ramo da loja.`,
      );
      continue;
    }

    // Já gravados, ainda sem categoria e sem edição sua: recebem a categoria encontrada agora.
    for (let i = 0; i < reavaliar.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const r of reavaliar.slice(i, i + BATCH_LIMIT))
        batch.update(r.ref, {
          categoryId: r.categoryId,
          isTransfer: r.isTransfer,
        });
      await batch.commit();
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
  for (const m of await revisarJanela(
    db,
    base,
    [...lancamentos.values()],
    categorias,
    seco,
  ))
    alterados.add(m);
  if (!seco) await gravarMesesAlterados(db, base, alterados);
  const faturas = await resumirFaturas(
    connector,
    contasPluggy,
    config,
    categorias,
    regras,
    ate,
  );
  console.log(`Faturas abertas resumidas: ${faturas.size} cartões.`);
  if (!seco) {
    await gravarSaldos(db, base, contasPluggy, config, faturas);
    await gravarConexoes(db, base, connector);
  }
}

/**
 * O que continua sem categoria na janela recebe a categoria de outros lançamentos da mesma
 * loja, também da janela. Meses anteriores não são lidos nem alterados: assim a sincronização
 * gasta só as leituras da janela, e o app não precisa reler meses antigos. Nada que já tem
 * categoria muda: as transações passadas mudam quando você pede, no app.
 */
async function revisarJanela(
  db: Firestore,
  base: string,
  lancamentos: (LancamentoGravado & { date: string })[],
  categorias: CategoriaRef[],
  seco: boolean,
): Promise<string[]> {
  const porLoja = inferirPeloHistorico(lancamentos, categorias);
  const data = new Map(lancamentos.map((l) => [l.id, l.date]));
  const meses = [...new Set(porLoja.map((m) => data.get(m.id)!.slice(0, 7)))];
  console.log(
    `Mesma loja na janela: ${porLoja.length} lançamentos sem categoria ${seco ? 'receberiam' : 'receberam'} categoria.`,
  );
  if (seco) return meses;
  for (let i = 0; i < porLoja.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const m of porLoja.slice(i, i + BATCH_LIMIT))
      batch.update(db.doc(`${base}/transactions/${m.id}`), {
        categoryId: m.categoryId,
      });
    await batch.commit();
  }
  return meses;
}

/**
 * `meta/meses` diz ao app quando cada mês mudou. O app guarda meses antigos no aparelho e só
 * os relê quando aparecem aqui com data mais nova que a cópia dele.
 */
async function gravarMesesAlterados(
  db: Firestore,
  base: string,
  meses: Set<string>,
): Promise<void> {
  if (!meses.size) return;
  const agora = new Date().toISOString();
  await db
    .doc(`${base}/meta/meses`)
    .set(Object.fromEntries([...meses].map((m) => [m, agora])), {
      merge: true,
    });
}

/**
 * Lançamentos já gravados que continuam sem categoria, nunca editados à mão, e para os quais
 * agora há categoria (regra nova, sugestão da Pluggy, ramo da loja) ou transferência.
 */
function reavaliacoes(
  prontos: LancamentoPronto[],
  gravados: QueryDocumentSnapshot[],
): {
  ref: DocumentReference;
  date: string;
  categoryId: string | null;
  isTransfer: boolean;
}[] {
  const porChave = new Map(
    gravados.map((d) => [d.get('dedupeKey') as string, d]),
  );
  const out = [];
  for (const { tx, categoryId } of prontos) {
    const d = porChave.get(tx.dedupeKey);
    if (
      !d ||
      d.get('categoryIsManual') ||
      d.get('isTransfer') ||
      d.get('categoryId')
    )
      continue;
    if (!categoryId && !tx.isTransfer) continue;
    out.push({
      ref: d.ref,
      date: tx.date,
      categoryId,
      isTransfer: !!tx.isTransfer,
    });
  }
  return out;
}

/**
 * Validade da autorização e última atualização de cada banco: o app avisa antes de vencer e
 * quando a sincronização para. Autorização vencida não dá erro na Pluggy, só leituras vazias.
 */
async function gravarConexoes(
  db: Firestore,
  base: string,
  connector: PluggyConnector,
): Promise<void> {
  const batch = db.batch();
  const syncedAt = new Date().toISOString();
  for (const item of await connector.listItems())
    batch.set(db.doc(`${base}/connections/${item.id}`), {
      provider: 'pluggy',
      name: item.connector?.name ?? null,
      status: item.status,
      errorCode: item.error?.code ?? null,
      consentExpiresAt: item.consentExpiresAt ?? null,
      bankUpdatedAt: item.lastUpdatedAt ?? null,
      syncedAt,
    });
  await batch.commit();
}

/**
 * Saldo de cada conta do banco, inclusive as sem mapeamento (a poupança entra no "Saldo
 * atual" do Início). Nunca vai para o log: no GitHub Actions ele é público.
 */
/**
 * Resumo da fatura aberta de cada cartão: compras do período, inclusive as pendentes, com as
 * regras do usuário. Vai só para o documento de saldo; nenhuma pendente vira transação.
 */
async function resumirFaturas(
  connector: PluggyConnector,
  contas: ConnectedAccount[],
  config: Config,
  categorias: CategoriaRef[],
  regras: RegraRef[],
  hoje: string,
): Promise<Map<string, ResumoFatura>> {
  const out = new Map<string, ResumoFatura>();
  for (const a of contas) {
    if (a.kind !== 'cartao') continue;
    const desde = inicioDaFaturaAberta(a.credito?.fechamento ?? null, hoje);
    const raw = await connector.fetchFaturaAberta(a, { from: desde, to: hoje });
    const noPeriodo = raw.filter((t) => t.date >= desde && t.date <= hoje);
    const prontos = categorizar(
      addDedupeKeys(config.contas[a.externalId] ?? a.externalId, noPeriodo),
      categorias,
      regras,
    );
    out.set(a.externalId, resumirFatura(prontos, desde));
  }
  return out;
}

async function gravarSaldos(
  db: Firestore,
  base: string,
  contas: ConnectedAccount[],
  config: Config,
  faturas: Map<string, ResumoFatura>,
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
      ...(a.kind === 'cartao'
        ? {
            credito: a.credito ?? null,
            faturaAberta: faturas.get(a.externalId) ?? null,
          }
        : {}),
    });
  }
  // Reconectar o banco troca os ids das contas: some com o saldo das que não existem mais.
  // Lista vazia é autorização vencida, não conta encerrada: aí guarda o último saldo.
  if (ids.size)
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
