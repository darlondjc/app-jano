import { deveLembrar } from './lembrete';

describe('deveLembrar', () => {
  const agora = new Date('2026-10-30T15:00:00Z');
  it('só depois de 7 dias sem importar', () => {
    expect(deveLembrar('2026-10-24T15:00:00Z', agora, null)).toBe(false);
    expect(deveLembrar('2026-10-23T15:00:00Z', agora, null)).toBe(true);
  });
  it('sem nenhuma importação não lembra', () => {
    expect(deveLembrar(null, agora, null)).toBe(false);
  });
  it('fica quieto por 2 dias depois de dispensado', () => {
    const velha = '2026-10-01T15:00:00Z';
    expect(deveLembrar(velha, agora, '2026-10-29T15:00:00Z')).toBe(false);
    expect(deveLembrar(velha, agora, '2026-10-28T15:00:00Z')).toBe(true);
  });
});
