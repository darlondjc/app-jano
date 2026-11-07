import { linhaDaConexao } from './conexao';

const agora = new Date('2026-11-06T10:36:00Z'); // 07:36 em São Paulo

describe('linhaDaConexao', () => {
  it('estado e hora da última consulta ao banco, no fuso de São Paulo', () => {
    expect(
      linhaDaConexao(
        {
          id: 'i1',
          connector: { name: 'Banco do Brasil' },
          status: 'UPDATED',
          lastUpdatedAt: '2026-11-06T08:12:00Z',
        },
        agora,
      ),
    ).toBe(
      'Conexão Banco do Brasil: UPDATED, banco consultado em 06/11 05:12 (há 2 h).',
    );
  });

  it('dias quando passa de dois dias, e o código do erro', () => {
    expect(
      linhaDaConexao(
        {
          id: 'i1',
          connector: { name: 'Banco do Brasil' },
          status: 'OUTDATED',
          lastUpdatedAt: '2026-11-02T10:00:00Z',
          error: { code: 'ACCOUNT_CREDENTIALS_RESET' },
        },
        agora,
      ),
    ).toBe(
      'Conexão Banco do Brasil: OUTDATED [ACCOUNT_CREDENTIALS_RESET], banco consultado em 02/11 07:00 (há 4 dias).',
    );
  });

  it('sem data de atualização', () => {
    expect(linhaDaConexao({ id: 'i1', status: 'UPDATING' }, agora)).toBe(
      'Conexão sem nome: UPDATING, banco ainda não consultado.',
    );
  });
});
