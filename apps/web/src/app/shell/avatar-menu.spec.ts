import { iniciais } from './avatar-menu';

describe('iniciais', () => {
  it('usa primeiro e último nome', () => {
    expect(iniciais('Darlon José Costa', null)).toBe('DC');
    expect(iniciais('  maria  ', null)).toBe('MA');
  });
  it('cai para o e-mail', () => {
    expect(iniciais(null, 'darlon@x.com')).toBe('D');
    expect(iniciais('', null)).toBe('?');
  });
});
