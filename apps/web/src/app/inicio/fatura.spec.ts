import { describe, expect, it } from 'vitest';
import { gerarDadosDemo } from '@jano/data-access';
import { cartaoDaFatura } from './fatura';

const dados = gerarDadosDemo(new Date(2026, 9, 31, 10));
const cartoes = new Set(['cartao-de-credito']);
const entrada = {
  saldos: dados.balances,
  txs: dados.transactions,
  cartoes,
  hoje: '2026-10-31',
};

describe('cartaoDaFatura', () => {
  const f = cartaoDaFatura(entrada)!;

  it('fatura fechada: valor do banco, vencimento, mínimo e situação', () => {
    expect(f.fase).toBe('fechada');
    expect(f.valorCents).toBe(
      dados.balances.find((b) => b.kind === 'cartao')!.balanceCents,
    );
    expect(f.vence).toBe('2026-11-07');
    expect(f.situacao).toBe('vence em 7 dias');
    expect(f.minimoCents).toBe(Math.round(f.valorCents * 0.15));
    expect(f.final).toBe('8670');
    expect(f.bandeira).toBe('Mastercard Black');
  });

  it('para onde foi: categorias da fatura fechada, somando o valor, com "Outras"', () => {
    const soma = f.composicao.reduce((s, p) => s + p.cents, 0);
    expect(soma).toBe(f.valorCents);
    expect(f.composicao.length).toBeLessThanOrEqual(5);
    expect(f.composicao[0].categoryId).toBe('mercado');
    expect(f.maiores).toHaveLength(3);
  });

  it('limite usado e o que já entrou na próxima', () => {
    expect(f.limite?.limiteCents).toBe(800000);
    expect(f.limite?.usadoCents).toBe(
      f.valorCents + (f.seguinte?.totalCents ?? 0),
    );
    expect(f.seguinte?.desde).toBe('2026-10-28');
  });

  it('todo mês no cartão: parcela com a próxima e assinaturas com nome', () => {
    expect(f.todoMes.itens.map((i) => `${i.nome} · ${i.detalhe}`)).toEqual([
      'Magazine Luiza · parcela 6 de 10',
      'Netflix.com · todo mês',
      'Spotify · todo mês',
    ]);
  });

  it('fatura aberta usa o resumo da sincronização, com pendentes', () => {
    const saldos = dados.balances.map((b) =>
      b.kind === 'cartao'
        ? { ...b, credito: { ...b.credito!, fechamento: '2026-11-27' } }
        : b,
    );
    const a = cartaoDaFatura({ ...entrada, saldos })!;
    expect(a.fase).toBe('aberta');
    expect(a.situacao).toBe('fecha em 27 dias');
    expect(a.valorCents).toBe(
      saldos.find((b) => b.kind === 'cartao')!.faturaAberta!.totalCents,
    );
  });

  it('sem cartão, nada', () => {
    expect(
      cartaoDaFatura({ ...entrada, saldos: [], cartoes: new Set() }),
    ).toBeNull();
  });
});

describe('cartaoDaFatura depois do pagamento', () => {
  // Dia 19: a fatura fechou em 27/09, venceu em 07/10 e foi paga no dia 7.
  const d = gerarDadosDemo(new Date(2026, 9, 19, 10));
  const e = {
    saldos: d.balances,
    txs: d.transactions,
    cartoes: new Set(['cartao-de-credito']),
    hoje: '2026-10-19',
  };

  it('paga: mostra a fatura aberta e quando fecha, não "vencida"', () => {
    const f = cartaoDaFatura(e)!;
    expect(f.situacao).not.toBe('vencida');
    expect(f.paga?.date).toBe('2026-10-07');
    expect(f.fase).toBe('aberta');
    expect(f.fecha).toBe('2026-10-27');
    expect(f.vence).toBe('2026-11-07');
    expect(f.situacao).toBe('fecha em 8 dias');
    expect(f.minimoCents).toBeNull();
    expect(f.seguinte).toBeNull();
  });

  it('sem o pagamento continua vencida', () => {
    const f = cartaoDaFatura({
      ...e,
      txs: d.transactions.filter(
        (t) => !/PAGTO CARTAO/.test(t.descriptionNorm),
      ),
    })!;
    expect(f.paga).toBeNull();
    expect(f.situacao).toBe('vencida');
  });
});

describe('cartaoDaFatura com os dias informados (banco sem datas)', () => {
  const d = gerarDadosDemo(new Date(2026, 10, 1, 10));
  // Como no BB pelo Open Finance: saldo do cartão sem os dados de crédito.
  const saldos = d.balances.map((b) =>
    b.kind === 'cartao'
      ? {
          ...b,
          credito: undefined,
          faturaAberta: undefined,
          balanceCents: 1_793_000,
        }
      : b,
  );
  const base = {
    saldos,
    txs: d.transactions,
    cartoes: new Set(['cartao-de-credito']),
    dias: { fecha: 25, vence: 5 },
  };
  const compras = (de: string, ate: string) =>
    -d.transactions
      .filter(
        (t) =>
          t.accountId === 'cartao-de-credito' &&
          !t.isTransfer &&
          t.date > de &&
          t.date <= ate,
      )
      .reduce((s, t) => s + t.amountCents, 0);

  it('entre o fechamento e o vencimento: a fechada, pelas compras do ciclo', () => {
    const f = cartaoDaFatura({ ...base, hoje: '2026-11-01' })!;
    expect(f.fase).toBe('fechada');
    expect(f.fecha).toBe('2026-10-25');
    expect(f.vence).toBe('2026-11-05');
    expect(f.situacao).toBe('vence em 4 dias');
    expect(f.valorCents).toBe(compras('2026-09-25', '2026-10-25'));
    // O saldo do banco (com parcelas futuras) aparece à parte.
    expect(f.totalNoCartaoCents).toBe(1_793_000);
    expect(f.diasInformados).toEqual({ fecha: 25, vence: 5 });
  });

  it('depois do vencimento: a aberta e quando fecha', () => {
    const f = cartaoDaFatura({ ...base, hoje: '2026-11-10' })!;
    expect(f.fase).toBe('aberta');
    expect(f.fecha).toBe('2026-11-25');
    expect(f.vence).toBe('2026-12-05');
    expect(f.situacao).toBe('fecha em 15 dias');
    expect(f.valorCents).toBe(compras('2026-10-25', '2026-11-10'));
  });

  it('sem dias informados: segue a estimativa de antes, com o nome sem caixa alta', () => {
    const f = cartaoDaFatura({ ...base, dias: null, hoje: '2026-11-01' })!;
    expect(f.fase).toBe('estimada');
    expect(f.diasInformados).toBeNull();
    expect(f.nome).toBe('Ourocard');
  });
});

describe('pagamento "PGTO CARTAO" (como no extrato do BB)', () => {
  it('é reconhecido: a fatura paga passa para a aberta', () => {
    const d = gerarDadosDemo(new Date(2026, 9, 19, 10));
    const txs = d.transactions.map((t) =>
      /PAGTO CARTAO/.test(t.descriptionNorm)
        ? { ...t, description: 'Pgto Cartao', descriptionNorm: 'PGTO CARTAO' }
        : t,
    );
    const f = cartaoDaFatura({
      saldos: d.balances,
      txs,
      cartoes: new Set(['cartao-de-credito']),
      hoje: '2026-10-19',
    })!;
    expect(f.paga?.date).toBe('2026-10-07');
    expect(f.situacao).toBe('fecha em 8 dias');
  });
});

describe('cartaoDaFatura com o valor oficial do banco', () => {
  const d = gerarDadosDemo(new Date(2026, 10, 1, 10));
  const comFaturas = (faturasBanco: unknown) =>
    d.balances.map((b) =>
      b.kind === 'cartao'
        ? {
            ...b,
            credito: undefined,
            faturaAberta: undefined,
            balanceCents: 1_793_000,
            faturasBanco,
          }
        : b,
    ) as typeof d.balances;
  const base = {
    txs: d.transactions,
    cartoes: new Set(['cartao-de-credito']),
    hoje: '2026-11-01',
  };
  const oficial = [
    { vencimento: '2026-11-05', totalCents: 885433, minimoCents: 132815 },
  ];

  it('com os dias informados, o valor e o mínimo são os do banco', () => {
    const f = cartaoDaFatura({
      ...base,
      saldos: comFaturas(oficial),
      dias: { fecha: 26, vence: 5 },
    })!;
    expect(f.valorCents).toBe(885433);
    expect(f.minimoCents).toBe(132815);
    expect(f.valorDoBanco).toBe(true);
    expect(f.situacao).toBe('vence em 4 dias');
  });

  it('mesmo sem dias informados, mostra valor e vencimento do banco', () => {
    const f = cartaoDaFatura({ ...base, saldos: comFaturas(oficial) })!;
    expect(f.fase).toBe('fechada');
    expect(f.vence).toBe('2026-11-05');
    expect(f.valorCents).toBe(885433);
  });

  it('fatura do banco já vencida não vale para a atual', () => {
    const f = cartaoDaFatura({
      ...base,
      saldos: comFaturas([
        { vencimento: '2026-10-05', totalCents: 1, minimoCents: null },
      ]),
    })!;
    expect(f.valorDoBanco).toBe(false);
  });
});

describe('valor oficial quando o banco manda também a próxima fatura', () => {
  const d = gerarDadosDemo(new Date(2026, 10, 1, 10));
  const saldos = d.balances.map((b) =>
    b.kind === 'cartao'
      ? {
          ...b,
          credito: undefined,
          faturaAberta: undefined,
          faturasBanco: [
            { vencimento: '2026-12-05', totalCents: 120000, minimoCents: 1 },
            { vencimento: '2026-11-05', totalCents: 885433, minimoCents: 2 },
            { vencimento: '2026-10-05', totalCents: 700000, minimoCents: 3 },
          ],
        }
      : b,
  ) as typeof d.balances;
  const base = {
    saldos,
    txs: d.transactions,
    cartoes: new Set(['cartao-de-credito']),
    hoje: '2026-11-01',
  };

  it('com os dias: a fatura que vence no dia calculado', () => {
    const f = cartaoDaFatura({ ...base, dias: { fecha: 26, vence: 5 } })!;
    expect(f.valorCents).toBe(885433);
  });

  it('sem os dias: a primeira que ainda não venceu', () => {
    const f = cartaoDaFatura(base)!;
    expect(f.valorCents).toBe(885433);
    expect(f.vence).toBe('2026-11-05');
  });
});
