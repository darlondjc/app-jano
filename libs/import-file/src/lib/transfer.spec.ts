import { describe, expect, it } from 'vitest';
import { normalizeDescription } from './normalize';
import { isLikelyTransfer } from './transfer';

const t = (s: string) => isLikelyTransfer(normalizeDescription(s));

describe('isLikelyTransfer', () => {
  it('reconhece pagamento de fatura', () => {
    expect(t('Pagamento de Fatura Ourocard')).toBe(true);
    expect(t('PGTO CARTAO CREDITO')).toBe(true);
    expect(t('Fatura Cartão 12/10')).toBe(true);
  });
  it('reconhece aplicação e resgate', () => {
    expect(t('BB Rende Fácil')).toBe(true);
    expect(t('REND.FACIL')).toBe(true);
    expect(t('Aplicação Financeira')).toBe(true);
    expect(t('Resgate CDB')).toBe(true);
    expect(t('Transferência para Poupança')).toBe(true);
  });
  it('não pega compras comuns', () => {
    expect(t('COMPRA CARTAO ATACADAO 22/10')).toBe(false);
    expect(t('Pix enviado Mercadinho Souza')).toBe(false);
    expect(t('Salário')).toBe(false);
    expect(t('Pagamento Energia Enel')).toBe(false);
  });
});
