import type { DadosDoUsuario } from '@jano/data-access';
import { reais, transacoesCsv } from './exportar';

const vazio = (): DadosDoUsuario => ({
  accounts: [],
  categories: [],
  budgets: [],
  rules: [],
  imports: [],
  transactions: [],
  recurrences: [],
  scenarios: [],
  insights: [],
  balances: [],
  connections: [],
});

describe('exportar', () => {
  it('formata centavos em reais com vírgula', () => {
    expect(reais(-123450)).toBe('-1234,50');
    expect(reais(5)).toBe('0,05');
  });

  it('gera CSV com categoria, conta e proteção contra fórmulas', () => {
    const d = vazio();
    d.accounts.push({ id: 'cc', nickname: 'Conta corrente' });
    d.categories.push({ id: 'mercado', name: 'Mercado' });
    d.transactions.push(
      {
        id: '1',
        date: '2026-10-02',
        description: 'Pão; "Açúcar"',
        amountCents: -18642,
        categoryId: 'mercado',
        accountId: 'cc',
        isTransfer: false,
      },
      {
        id: '2',
        date: '2026-10-05',
        description: '=SOMA(A1)',
        amountCents: 100,
        categoryId: null,
        accountId: 'cc',
        isTransfer: true,
      },
    );
    const linhas = transacoesCsv(d).replace('﻿', '').split('\r\n');
    expect(linhas[0]).toBe(
      'Data;Descrição;Valor (R$);Categoria;Conta;Transferência',
    );
    expect(linhas[1]).toBe("2026-10-05;'=SOMA(A1);1,00;;Conta corrente;sim");
    expect(linhas[2]).toBe(
      '2026-10-02;"Pão; ""Açúcar""";-186,42;Mercado;Conta corrente;não',
    );
  });
});
