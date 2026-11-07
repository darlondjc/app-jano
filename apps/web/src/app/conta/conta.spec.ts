import { diaEHora, haQuantoTempo } from './tempo';

describe('haQuantoTempo', () => {
  const agora = new Date('2026-10-30T15:00:00Z');
  it('descreve hoje, ontem e dias', () => {
    expect(haQuantoTempo('2026-10-30T10:00:00Z', agora)).toBe('hoje');
    expect(haQuantoTempo('2026-10-29T10:00:00Z', agora)).toBe('ontem');
    expect(haQuantoTempo('2026-10-18T15:00:00Z', agora)).toBe('há 12 dias');
  });
});

describe('diaEHora', () => {
  const agora = new Date('2026-11-07T12:00:00Z'); // 09:00 em São Paulo
  it('hoje, ontem ou a data, com a hora de São Paulo', () => {
    expect(diaEHora('2026-11-07T10:34:00Z', agora)).toBe('hoje, 07:34');
    expect(diaEHora('2026-11-07T01:10:00Z', agora)).toBe('ontem, 22:10');
    expect(diaEHora('2026-11-02T10:34:00Z', agora)).toBe('02/11, 07:34');
  });
});
