import { paths } from './paths';

describe('paths', () => {
  it('isola tudo sob users/{uid}', () => {
    expect(paths.transactions('abc')).toBe('users/abc/transactions');
    for (const fn of Object.values(paths))
      expect(fn('u1').startsWith('users/u1')).toBe(true);
  });
});
