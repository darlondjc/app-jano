import { regraGenerica, regraQueCasa } from './categorize';

describe('regraGenerica', () => {
  it('só operação e hora não identificam a loja', () => {
    expect(regraGenerica('COMPRA C CARTAO')).toBe(true);
    expect(regraGenerica('COMPRA C CARTAO 17 15')).toBe(true);
    expect(regraGenerica('PIX ENVIADO')).toBe(true);
    expect(regraGenerica('AB')).toBe(true);
  });
  it('com o nome da loja vale', () => {
    expect(regraGenerica('PADARIA BOA VISTA')).toBe(false);
    expect(regraGenerica('PIX FULANO')).toBe(false);
    expect(regraGenerica('99 POP')).toBe(false);
  });
});

describe('regraQueCasa', () => {
  const r = (pattern: string, createdAt = '2026-10-01') => ({
    pattern,
    createdAt,
  });
  it('vence a mais específica, não a primeira da lista', () => {
    expect(
      regraQueCasa('MATEUS SUPERMERCADOS SAO LUIS', [
        r('MATEUS'),
        r('MATEUS SUPERMERCADOS'),
      ])?.pattern,
    ).toBe('MATEUS SUPERMERCADOS');
  });
  it('no empate, a mais recente', () => {
    expect(
      regraQueCasa('LOJA X', [r('LOJA', '2026-09-01'), r('LOJA', '2026-10-01')])
        ?.createdAt,
    ).toBe('2026-10-01');
  });
  it('ignora regra genérica', () => {
    expect(
      regraQueCasa('COMPRA C CARTAO 17 15 PADARIA', [r('COMPRA C CARTAO')]),
    ).toBeUndefined();
  });
});
