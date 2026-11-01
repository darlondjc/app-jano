import { describe, expect, it } from 'vitest';
import { gerarDadosDemo } from '@jano/data-access';
import { diaDaFatura, planoDoMes } from './plano';
import { montarRecorrencias, totalMensal } from '../recorrencias/linhas';

const hoje = new Date(2026, 9, 31, 10);
const dados = gerarDadosDemo(hoje);
const cartoes = new Set(['cartao-de-credito']);
const fatura = dados.balances.find((b) => b.kind === 'cartao')!.balanceCents;

describe('planoDoMes', () => {
  const plano = planoDoMes({
    saldoCents: 1_248_032,
    faturaCents: fatura,
    txs: dados.transactions,
    cartoes,
    hoje: '2026-10-31',
  });

  it('lista os próximos 30 dias em ordem, com o saldo depois de cada um', () => {
    const nomes = plano.eventos.map((e) => `${e.data?.slice(5)} ${e.nome}`);
    expect(nomes).toEqual([
      '11-05 Salario Empresa Exemplo Ltda',
      '11-07 Fatura do cartão',
      '11-10 Escola Pequeno Principe',
      '11-13 Maria Souza', // PIX todo mês para a mesma pessoa
      '11-15 Energia Eletrica Exemplo',
      '11-20 Internet Fibra Exemplo',
      '11-24 Imobiliaria Centro',
    ]);
    const [salario, faturaEv] = plano.eventos;
    expect(salario.saldoDepois).toBe(1_248_032 + 985_000);
    expect(faturaEv.cents).toBe(-fatura);
    expect(faturaEv.saldoDepois).toBe(1_248_032 + 985_000 - fatura);
  });

  it('o que já foi pago neste mês não entra de novo', () => {
    const doDia = planoDoMes({
      saldoCents: 500_000,
      faturaCents: 0,
      txs: dados.transactions,
      cartoes,
      hoje: '2026-10-16',
    });
    const nomes = doDia.eventos.map((e) => e.nome);
    // Luz (dia 15) e escola (dia 10) já foram; internet (20) e aluguel (24) ainda vêm.
    expect(nomes).toContain('Internet Fibra Exemplo');
    expect(nomes).toContain('Imobiliaria Centro');
    expect(
      doDia.eventos.find((e) => e.nome === 'Escola Pequeno Principe')?.data,
    ).toBe('2026-11-10');
  });

  it('comprometido: contas fixas mais as parcelas que ainda faltam, sobre a renda', () => {
    expect(plano.rendaCents).toBe(985_000);
    const [nov, dez, jan, fev] = plano.comprometido;
    expect(nov.mes).toBe('2026-11');
    expect(nov.parcelasCents).toBe(34_990);
    expect(fev.mes).toBe('2027-02');
    // A parcelada em 10x, na 5ª agora, vai até março: as quatro barras têm parcela.
    expect([nov, dez, jan, fev].every((m) => m.parcelasCents === 34_990)).toBe(
      true,
    );
    expect(nov.fixasCents).toBeGreaterThan(0);
    expect(nov.pct).toBe(
      Math.round(((nov.fixasCents + nov.parcelasCents) / 985_000) * 100),
    );
  });

  it('sem saldo do banco, sem "pode gastar" nem saldo previsto', () => {
    const p = planoDoMes({
      saldoCents: null,
      faturaCents: 0,
      txs: dados.transactions,
      cartoes,
      hoje: '2026-10-31',
    });
    expect(p.gastar).toBeNull();
    expect(p.eventos.every((e) => e.saldoDepois === null)).toBe(true);
  });
});

describe('diaDaFatura', () => {
  it('pega o dia dos pagamentos de fatura na conta', () => {
    expect(
      diaDaFatura(dados.transactions.filter((t) => !cartoes.has(t.accountId))),
    ).toBe(7);
  });
  it('sem pagamento de fatura, não há dia', () => {
    expect(diaDaFatura([])).toBeNull();
  });
});

describe('gasto fixo: uma regra só', () => {
  it('Recorrências e Projeções somam o mesmo; posto e farmácia no cartão ficam de fora', () => {
    const hoje = '2026-10-31';
    const linhas = montarRecorrencias(
      dados.transactions,
      hoje,
      'assinaturas',
      cartoes,
    );
    const frequentes = linhas
      .filter((l) => l.grupo === 'frequentes')
      .map((l) => l.nome);
    expect(frequentes).toEqual(
      expect.arrayContaining(['Posto Ipiranga Centro']),
    );
    const p = planoDoMes({
      saldoCents: 0,
      faturaCents: 0,
      txs: dados.transactions,
      cartoes,
      hoje,
    });
    const proximo = p.comprometido[0];
    expect(totalMensal(linhas, 'gasto')).toBe(
      proximo.fixasCents + proximo.parcelasCents,
    );
  });
});
