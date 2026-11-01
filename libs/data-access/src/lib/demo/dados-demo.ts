import { normalizeDescription, type KeyedTransaction } from '@jano/import-file';
import { resumirFatura } from '@jano/open-finance';
import type { BudgetDoc } from '../data/budgets.repository';
import {
  DEFAULT_CATEGORIES,
  slugify,
  type AccountDoc,
  type BalanceDoc,
  type CategoryDoc,
  type ConnectionDoc,
  type TransactionDoc,
} from '../data/models';

/** Tudo o que o modo demonstração mostra: dados fictícios, sempre os mesmos para o mesmo dia. */
export interface DadosDemo {
  accounts: AccountDoc[];
  categories: CategoryDoc[];
  transactions: TransactionDoc[];
  budgets: BudgetDoc[];
  balances: BalanceDoc[];
  connections: ConnectionDoc[];
}

const CONTA = 'conta-corrente';
const CARTAO = 'cartao-de-credito';
/** Meses de histórico antes do atual. */
const MESES = 6;

/** Gerador pseudoaleatório com semente: os valores variam, mas sempre do mesmo jeito. */
function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Dados de demonstração para `hoje`: o mês atual (até hoje) e os seis anteriores. */
export function gerarDadosDemo(hoje = new Date()): DadosDemo {
  const categories: CategoryDoc[] = [
    ...DEFAULT_CATEGORIES.map((c, position) => ({
      ...c,
      id: slugify(c.name),
      position,
    })),
  ];
  const hojeIso = isoLocal(hoje);
  const transactions: TransactionDoc[] = [];
  let seq = 0;
  const lancar = (
    date: string,
    reais: number,
    description: string,
    categoryId: string | null,
    accountId: string,
    extra: Partial<TransactionDoc> = {},
  ) => {
    if (date > hojeIso) return;
    const id = `demo-${++seq}`;
    transactions.push({
      id,
      accountId,
      date,
      amountCents: Math.round(reais * 100),
      description,
      descriptionNorm: normalizeDescription(description),
      dedupeKey: id,
      categoryId,
      categoryIsManual: false,
      isTransfer: false,
      importId: null,
      ...extra,
    });
  };

  /** Fatura que fechou no dia 27 do mês anterior: compras de 28 de dois meses atrás até lá. */
  const faturaFechada = (ano: number, mes: number) => {
    const fecha = isoLocal(new Date(ano, mes - 2, DIA_FECHAMENTO));
    const abre = isoLocal(new Date(ano, mes - 3, DIA_FECHAMENTO));
    const cents = transactions
      .filter(
        (t) =>
          t.accountId === CARTAO &&
          !t.isTransfer &&
          t.date > abre &&
          t.date <= fecha,
      )
      .reduce((s, t) => s - t.amountCents, 0);
    // A primeira fatura do histórico fica incompleta: sem pagamento.
    return k0(ano, mes) ? 0 : cents / 100;
  };
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - MESES, 1);
  const k0 = (ano: number, mes: number) =>
    ano === primeiro.getFullYear() && mes === primeiro.getMonth() + 1;

  for (let k = MESES; k >= 0; k--) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1);
    const ano = inicio.getFullYear();
    const mes = inicio.getMonth() + 1;
    const ultimo = new Date(ano, mes, 0).getDate();
    const dia = (d: number) =>
      `${ano}-${doisDigitos(mes)}-${doisDigitos(Math.min(d, ultimo))}`;
    const dm = (d: number) =>
      `${doisDigitos(Math.min(d, ultimo))}/${doisDigitos(mes)}`;
    const r = sorteio(ano * 100 + mes);
    const entre = (min: number, max: number) =>
      Math.round((min + r() * (max - min)) * 100) / 100;

    // Conta corrente: salário, contas fixas, pagamento da fatura e compras no débito.
    lancar(dia(5), 9850, 'SALARIO EMPRESA EXEMPLO LTDA', 'receita', CONTA);
    const faturaAnterior = faturaFechada(ano, mes);
    if (faturaAnterior > 0)
      lancar(dia(7), -faturaAnterior, 'PAGTO CARTAO CREDITO', null, CONTA, {
        isTransfer: true,
      });
    lancar(
      dia(10),
      -1450,
      `PIX - ENVIADO ${dm(10)} 08:30 ESCOLA PEQUENO PRINCIPE`,
      'educacao',
      CONTA,
    );
    lancar(
      dia(15),
      -entre(240, 320),
      'ENERGIA ELETRICA EXEMPLO',
      'moradia',
      CONTA,
    );
    lancar(
      dia(20),
      -119.9,
      'INTERNET FIBRA EXEMPLO',
      'celular-e-internet',
      CONTA,
    );
    lancar(
      dia(24),
      -2400,
      `PIX - ENVIADO ${dm(24)} 09:10 IMOBILIARIA CENTRO`,
      'moradia',
      CONTA,
    );
    for (const d of [2, 8, 17, 25])
      lancar(
        dia(d),
        -entre(9, 32),
        `COMPRA C/CARTAO ${dm(d)} 07:4${d % 10} PADARIA BOA VISTA`,
        'restaurantes',
        CONTA,
      );
    lancar(
      dia(13),
      -150,
      `PIX - ENVIADO ${dm(13)} 19:02 MARIA SOUZA`,
      null,
      CONTA,
    );

    // Cartão: mercado, combustível, restaurantes, assinaturas, farmácia, lazer e uma compra parcelada.
    const noCartao = (
      d: number,
      reais: number,
      desc: string,
      cat: string | null,
      extra: Partial<TransactionDoc> = {},
    ) => lancar(dia(d), -reais, desc, cat, CARTAO, extra);
    for (const d of [3, 11, 19, 26])
      noCartao(d, entre(150, 290), 'MATEUS SUPERMERCADOS', 'mercado');
    for (const d of [6, 21])
      noCartao(d, entre(190, 280), 'POSTO IPIRANGA CENTRO', 'combustivel');
    for (const d of [9, 16, 23, 29])
      noCartao(d, entre(45, 95), 'IFOOD *RESTAURANTE', 'restaurantes');
    noCartao(12, 55.9, 'NETFLIX.COM', 'assinaturas');
    noCartao(18, 21.9, 'SPOTIFY', 'assinaturas');
    noCartao(14, entre(60, 140), 'DROGASIL 1234', 'farmacia');
    noCartao(27, entre(70, 110), 'CINEMARK', 'lazer');
    // Parcelada em 10x, comprada 4 meses atrás.
    const parcela = MESES - k - 1;
    if (parcela >= 1 && parcela <= 10)
      noCartao(4, 349.9, 'MAGAZINE LUIZA', 'compras', {
        installment: { n: parcela, total: 10 },
      });
    if (k === 0) {
      // Novidades do mês: assinatura nova, compra sem categoria e um gasto fora do padrão.
      noCartao(3, 24.9, 'YOUTUBE PREMIUM', 'assinaturas');
      noCartao(22, 89.9, 'MERCADOLIVRE*LOJAEXEMPLO', null);
      noCartao(
        Math.max(1, Math.min(hoje.getDate(), 28)),
        690,
        'MATEUS SUPERMERCADOS ATACADO',
        'mercado',
      );
    }
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));
  const fatura = faturaDemo(transactions, hoje);
  const syncedAt = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    6,
  ).toISOString();
  const consentimento = new Date(hoje);
  consentimento.setDate(consentimento.getDate() + 300);
  return {
    accounts: [
      { id: CONTA, nickname: 'Conta corrente', type: 'conta' },
      { id: CARTAO, nickname: 'Cartão de crédito', type: 'cartao' },
    ],
    categories,
    transactions,
    budgets: [
      { categoryId: 'mercado', limitCents: 140000 },
      { categoryId: 'restaurantes', limitCents: 60000 },
      { categoryId: 'combustivel', limitCents: 50000 },
      { categoryId: 'lazer', limitCents: 30000 },
      { categoryId: 'moradia', limitCents: 280000 },
      { categoryId: 'educacao', limitCents: 145000 },
      { categoryId: 'celular-e-internet', limitCents: 15000 },
      { categoryId: 'assinaturas', limitCents: 12000 },
      { categoryId: 'farmacia', limitCents: 20000 },
    ],
    balances: [
      {
        id: 'demo-cc',
        name: 'Conta Corrente',
        kind: 'conta',
        detail: 'corrente',
        accountId: CONTA,
        balanceCents: 1248032,
        bankUpdatedAt: syncedAt,
        syncedAt,
      },
      {
        id: 'demo-pp',
        name: 'Poupança',
        kind: 'conta',
        detail: 'poupança',
        accountId: null,
        balanceCents: 520000,
        bankUpdatedAt: syncedAt,
        syncedAt,
      },
      {
        id: 'demo-cr',
        name: 'Ourocard',
        kind: 'cartao',
        detail: 'cartão de crédito',
        number: '8670',
        accountId: CARTAO,
        balanceCents: fatura.saldoCents,
        bankUpdatedAt: syncedAt,
        syncedAt,
        credito: fatura.credito,
        faturaAberta: fatura.aberta,
      },
    ],
    connections: [
      {
        id: 'demo-item',
        provider: 'pluggy',
        name: 'Banco de exemplo',
        status: 'UPDATED',
        errorCode: null,
        consentExpiresAt: consentimento.toISOString(),
        bankUpdatedAt: syncedAt,
        syncedAt,
      },
    ],
  };
}

/** Dia em que a fatura de demonstração fecha; vence no dia 7 do mês seguinte. */
const DIA_FECHAMENTO = 27;

/**
 * Cartão da demonstração: fecha dia 27 e vence dia 7. A fatura fechada é o saldo devido; o que
 * veio depois do fechamento forma o resumo da fatura aberta, como a sincronização grava.
 */
function faturaDemo(transactions: TransactionDoc[], hoje: Date) {
  const iso = (a: number, m: number, d: number) => isoLocal(new Date(a, m, d));
  const a = hoje.getFullYear();
  const m = hoje.getMonth();
  const fechou = hoje.getDate() > DIA_FECHAMENTO;
  const fechamento = fechou
    ? iso(a, m, DIA_FECHAMENTO)
    : iso(a, m - 1, DIA_FECHAMENTO);
  const anterior = fechou
    ? iso(a, m - 1, DIA_FECHAMENTO)
    : iso(a, m - 2, DIA_FECHAMENTO);
  const vencimento = fechou ? iso(a, m + 1, 7) : iso(a, m, 7);
  const doCartao = transactions.filter(
    (t) => t.accountId === CARTAO && !t.isTransfer,
  );
  const fechadaCents = -doCartao
    .filter((t) => t.date > anterior && t.date <= fechamento)
    .reduce((s, t) => s + t.amountCents, 0);
  // A fatura aberta começa no dia seguinte ao fechamento.
  const desde = fechou
    ? iso(a, m, DIA_FECHAMENTO + 1)
    : iso(a, m - 1, DIA_FECHAMENTO + 1);
  const aberta = resumirFatura(
    doCartao.map((t) => ({
      tx: { ...t, dedupeKey: t.dedupeKey } as unknown as KeyedTransaction,
      categoryId: t.categoryId,
    })),
    desde,
  );
  const limiteCents = 800000;
  // Paga no dia 7 (ver "PAGTO CARTAO CREDITO"): o banco passa a dever só a aberta.
  const paga = !fechou && hoje.getDate() >= 7;
  const devidoCents = paga
    ? aberta.totalCents
    : fechadaCents + aberta.totalCents;
  return {
    saldoCents: paga ? aberta.totalCents : fechadaCents,
    aberta,
    credito: {
      limiteCents,
      disponivelCents: limiteCents - devidoCents,
      fechamento,
      vencimento,
      minimoCents: Math.round(fechadaCents * 0.15),
      bandeira: 'Mastercard Black',
    },
  };
}
