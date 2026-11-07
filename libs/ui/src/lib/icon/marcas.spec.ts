import { bandeiraDe, semBandeira } from './marcas';

describe('bandeiraDe', () => {
  it('reconhece a bandeira no texto do banco', () => {
    expect(bandeiraDe('Visa Platinum')).toBe('visa');
    expect(bandeiraDe(null, 'OUROCARD MASTERCARD BLACK')).toBe('mastercard');
    expect(bandeiraDe('American Express Green')).toBe('amex');
    expect(bandeiraDe('Elo Grafite')).toBeNull();
    expect(bandeiraDe(null)).toBeNull();
  });
});

describe('semBandeira', () => {
  it('tira a bandeira só do fim do nome', () => {
    expect(semBandeira('Ourocard Platinum Estilo Visa')).toBe(
      'Ourocard Platinum Estilo',
    );
    expect(semBandeira('Ourocard Mastercard Black')).toBe(
      'Ourocard Mastercard Black',
    );
    expect(semBandeira('Visa')).toBe('Visa');
  });
});
