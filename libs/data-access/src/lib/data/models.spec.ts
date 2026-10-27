import { monthBounds, slugify } from './models';

describe('models', () => {
  it('slugify remove acento', () => expect(slugify('Saúde')).toBe('saude'));
  it('monthBounds vira o ano em dezembro', () => {
    expect(monthBounds('2026-12')).toEqual({
      from: '2026-12-01',
      toExclusive: '2027-01-01',
    });
    expect(monthBounds('2026-10')).toEqual({
      from: '2026-10-01',
      toExclusive: '2026-11-01',
    });
  });
});
