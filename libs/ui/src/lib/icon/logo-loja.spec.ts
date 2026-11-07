import { corDoDesenho, logoDaLoja } from './logo-loja';

describe('logoDaLoja', () => {
  it('reconhece a marca na descrição do banco', () => {
    expect(logoDaLoja('NETFLIX.COM')?.nome).toBe('Netflix');
    expect(logoDaLoja('APPLE.COM/BILL')?.nome).toBe('Apple');
    expect(logoDaLoja('PAG*IFOOD')?.nome).toBe('iFood');
    expect(logoDaLoja('UBER *TRIP HELP.UBER.COM')?.nome).toBe('Uber');
    expect(logoDaLoja('Uber Eats')?.nome).toBe('Uber Eats');
    expect(logoDaLoja('YOUTUBE GOOGLE')?.nome).toBe('YouTube');
  });

  it('só por palavra inteira e nada quando não conhece', () => {
    expect(logoDaLoja('POSTO UBERLANDIA')).toBeNull();
    expect(logoDaLoja('PADARIA BOA VISTA')).toBeNull();
    expect(logoDaLoja(null, '')).toBeNull();
  });
});

describe('corDoDesenho', () => {
  it('branco no fundo escuro e escuro no claro', () => {
    expect(corDoDesenho('#E50914')).toBe('#fff');
    expect(corDoDesenho('#FBC817')).toBe('#111');
  });
});

describe('Amazon', () => {
  it('Prime Video antes da loja', () => {
    expect(logoDaLoja('AMAZON PRIME CANAIS')?.nome).toBe('Amazon Prime');
    expect(logoDaLoja('AMAZON.COM.BR MARKETPLACE')?.nome).toBe('Amazon');
    expect(logoDaLoja('AMZN Mktp BR')?.nome).toBe('Amazon');
  });
});

describe('Hyundai', () => {
  it('pelo nome da marca ou da concessionária', () => {
    expect(logoDaLoja('PATEO HYUNDAI SLZ')?.nome).toBe('Hyundai');
    expect(logoDaLoja('PATEO VEICULOS')?.nome).toBe('Hyundai');
  });
});

describe('logos coloridos (arquivo)', () => {
  it('lojas brasileiras pela descrição', () => {
    expect(logoDaLoja('MATEUS SUPERMERCADOS ATACADO')?.arquivo).toBe(
      'logos/mateus.png',
    );
    expect(logoDaLoja('MIX MATEUS SLZ')?.nome).toBe('Grupo Mateus');
    expect(logoDaLoja('DROGASIL 1234')?.nome).toBe('Drogasil');
    expect(logoDaLoja('TELEFONICA BRASIL S A')?.nome).toBe('Vivo');
    expect(logoDaLoja('SMARTFIT ESCOLA')?.nome).toBe('Smart Fit');
    expect(logoDaLoja('GLOBO PREMIERE')?.nome).toBe('Premiere');
    expect(logoDaLoja('O BOTICARIO SAO LUIS')?.nome).toBe('O Boticário');
    expect(logoDaLoja('MERCADOLIVRE*VENDEDOR')?.nome).toBe('Mercado Livre');
    expect(logoDaLoja('MERCADO PAGO*LOJA')?.nome).toBe('Mercado Pago');
  });
});
