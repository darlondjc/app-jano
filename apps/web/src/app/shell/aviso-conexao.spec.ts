import type { ConnectionDoc } from '@jano/data-access';
import {
  RENOVAR_URL,
  SINCRONIZAR_URL,
  avisoConexao,
  avisoOffline,
  haQuanto,
} from './aviso-conexao';

const agora = new Date('2026-10-30T12:00:00.000Z');

function c(over: Partial<ConnectionDoc>): ConnectionDoc {
  return {
    id: 'item',
    provider: 'pluggy',
    name: 'MeuPluggy',
    status: 'UPDATED',
    errorCode: null,
    consentExpiresAt: '2027-10-30T12:00:00.000Z',
    bankUpdatedAt: '2026-10-30T03:00:00.000Z',
    syncedAt: '2026-10-30T09:00:00.000Z',
    ...over,
  };
}

describe('avisoConexao', () => {
  it('sem conexão ou tudo em dia: nenhum aviso', () => {
    expect(avisoConexao([], agora)).toBeNull();
    expect(avisoConexao([c({})], agora)).toBeNull();
  });

  it('avisa 15 dias antes de vencer, com o número de dias', () => {
    const a = avisoConexao(
      [c({ consentExpiresAt: '2026-11-14T12:00:00.000Z' })],
      agora,
    );
    expect(a?.tom).toBe('warn');
    expect(a?.titulo).toBe('O consentimento expira em 15 dias.');
    expect(a?.acao.href).toBe(RENOVAR_URL);
    expect(
      avisoConexao(
        [c({ consentExpiresAt: '2026-11-15T12:00:00.000Z' })],
        agora,
      ),
    ).toBeNull();
    expect(
      avisoConexao([c({ consentExpiresAt: '2026-10-31T10:00:00.000Z' })], agora)
        ?.titulo,
    ).toBe('O consentimento expira amanhã.');
  });

  it('vencida pela data ou pelo erro da Pluggy', () => {
    expect(
      avisoConexao([c({ consentExpiresAt: '2026-10-29T00:00:00.000Z' })], agora)
        ?.titulo,
    ).toBe('O consentimento expirou.');
    const a = avisoConexao(
      [c({ status: 'LOGIN_ERROR', errorCode: 'USER_AUTHORIZATION_EXPIRED' })],
      agora,
    );
    expect(a?.tom).toBe('danger');
    expect(a?.titulo).toBe('O consentimento expirou.');
  });

  it('sincronização parada há mais de dois dias ou com erro', () => {
    const a = avisoConexao(
      [
        c({
          syncedAt: '2026-10-27T09:00:00.000Z',
          bankUpdatedAt: '2026-10-24T03:00:00.000Z',
        }),
      ],
      agora,
    );
    expect(a?.titulo).toBe('A sincronização falhou.');
    expect(a?.texto).toContain('desde 24 de outubro');
    expect(a?.acao.href).toBe(SINCRONIZAR_URL);
    expect(avisoConexao([c({ status: 'OUTDATED' })], agora)?.titulo).toBe(
      'A sincronização falhou.',
    );
  });

  it('mostra só o mais grave', () => {
    const a = avisoConexao(
      [
        c({ id: 'a', consentExpiresAt: '2026-11-05T12:00:00.000Z' }),
        c({ id: 'b', status: 'OUTDATED' }),
      ],
      agora,
    );
    expect(a?.titulo).toBe('A sincronização falhou.');
  });

  it('sem conexão: diz de quando são os dados', () => {
    expect(haQuanto('2026-10-30T11:55:00.000Z', agora)).toBe('há 5 minutos');
    expect(haQuanto('2026-10-30T10:00:00.000Z', agora)).toBe('há 2 horas');
    expect(haQuanto('2026-10-28T12:00:00.000Z', agora)).toBe('há 2 dias');
    const a = avisoOffline('2026-10-30T11:55:00.000Z', agora);
    expect(a.titulo).toBe('Sem conexão.');
    expect(a.texto).toContain('dados de há 5 minutos');
    expect(a.acao).toBeUndefined();
  });

  it('cota do servidor esgotada tem aviso próprio', () => {
    const a = avisoOffline(
      '2026-10-31T15:00:00Z',
      new Date('2026-10-31T15:30:00Z'),
      'cota',
    );
    expect(a.titulo).toBe('Limite diário do servidor atingido.');
    expect(a.texto).toContain('há 30 minutos');
    expect(a.texto).toContain('4h');
  });
});
