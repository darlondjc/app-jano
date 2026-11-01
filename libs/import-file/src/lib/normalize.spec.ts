import { describe, expect, it } from 'vitest';
import { nomeDeExibicao, tipoDeOperacao } from './normalize';

describe('nomeDeExibicao', () => {
  it.each([
    [
      'PIX - ENVIADO 10/10 08:30 ESCOLA PEQUENO PRINCIPE',
      'Escola Pequeno Principe',
    ],
    ['COMPRA C/CARTAO 17/10 07:47 PADARIA BOA VISTA', 'Padaria Boa Vista'],
    ['MATEUS SUPERMERCADOS ATACADO', 'Mateus Supermercados Atacado'],
    ['DROGASIL 1234', 'Drogasil'],
    ['IFOOD *RESTAURANTE', 'Ifood Restaurante'],
    ['NETFLIX.COM', 'Netflix.com'],
    ['CASA DE CARNES DO ZE', 'Casa de Carnes do Ze'],
    ['PAGAMENTO IPVA', 'Pagamento IPVA'],
    ['Conta de luz', 'Conta de luz'],
    ['PIX - ENVIADO 13/10 19:02 ', 'Pix - Enviado 13/10 19:02'],
  ])('%s → %s', (de, para) => {
    expect(nomeDeExibicao(de)).toBe(para);
  });
});

describe('tipoDeOperacao', () => {
  it('reconhece Pix e débito', () => {
    expect(tipoDeOperacao('PIX - ENVIADO 10/10 08:30 ESCOLA')).toBe(
      'Pix enviado',
    );
    expect(tipoDeOperacao('PIX - RECEBIDO 10/10 FULANO')).toBe('Pix recebido');
    expect(tipoDeOperacao('COMPRA C/CARTAO 17/10 07:47 PADARIA')).toBe(
      'Débito',
    );
    expect(tipoDeOperacao('NETFLIX.COM')).toBeNull();
  });
});
