import { haQuantoTempo } from './conta';

describe('haQuantoTempo', () => {
  const agora = new Date('2026-10-30T15:00:00Z');
  it('descreve hoje, ontem e dias', () => {
    expect(haQuantoTempo('2026-10-30T10:00:00Z', agora)).toBe('hoje');
    expect(haQuantoTempo('2026-10-29T10:00:00Z', agora)).toBe('ontem');
    expect(haQuantoTempo('2026-10-18T15:00:00Z', agora)).toBe('há 12 dias');
  });
});
