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
      'MAGAZINE LUIZA · parcela 6 de 10',
      'NETFLIX.COM · todo mês',
      'SPOTIFY · todo mês',
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
