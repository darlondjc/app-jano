import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDedupeKeys, hashKey } from './dedupe';
import { parseAmountToCents } from './money';
import { normalizeDescription } from './normalize';
import { decodeBytes, parseOfx } from './ofx';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name));

describe('parseAmountToCents', () => {
  it.each([
    ['-480.00', -48000],
    ['6350.00', 635000],
    ['-42,00', -4200],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['R$ 12,5', 1250],
    ['(12,00)', -1200],
    ['12,00-', -1200],
    ['1.234', 123400],
    ['1.234.567,89', 123456789],
    ['0,05', 5],
  ])('%s → %i', (input, cents) =>
    expect(parseAmountToCents(input)).toBe(cents),
  );

  it.each(['', 'abc', '1,2,x'])('rejeita %j', (input) =>
    expect(parseAmountToCents(input)).toBeNull(),
  );
});

describe('parseOfx SGML (conta corrente)', () => {
  const r = parseOfx(decodeBytes(fx('conta-sgml.ofx')));

  it('lê as 3 transações sem erro', () => {
    expect(r.errors).toEqual([]);
    expect(r.transactions).toHaveLength(3);
  });
  it('ignora hora e fuso na data', () =>
    expect(r.transactions[0].date).toBe('2026-10-22'));
  it('guarda valor em centavos e FITID', () => {
    expect(r.transactions[0]).toMatchObject({
      amountCents: -48000,
      externalId: '20261022001',
    });
    expect(r.transactions[1].amountCents).toBe(635000);
  });
  it('junta NAME e MEMO; aceita vírgula decimal', () => {
    expect(r.transactions[1].description).toBe('SALARIO Crédito de salário');
    expect(r.transactions[2]).toMatchObject({
      amountCents: -4200,
      description: 'PIX MERCADINHO SOUZA',
    });
    expect(r.transactions[2].externalId).toBeUndefined();
  });
});

describe('parseOfx XML (cartão)', () => {
  const r = parseOfx(decodeBytes(fx('cartao-xml.ofx')));

  it('lê as válidas e relata as inválidas com motivo', () => {
    expect(r.transactions.map((t) => t.externalId)).toEqual(['C1', 'C2']);
    expect(r.errors).toEqual([
      { index: 2, reason: 'Data inválida ou ausente (DTPOSTED).' },
      { index: 3, reason: 'Valor inválido ou ausente (TRNAMT).' },
    ]);
  });
  it('decodifica entidades XML', () =>
    expect(r.transactions[1].description).toBe('NETFLIX & CIA'));
});

describe('decodeBytes', () => {
  it('usa windows-1252 quando não é UTF-8 válido', () => {
    const bytes = Uint8Array.from([0x43, 0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f]); // "Crédito" em 1252
    expect(decodeBytes(bytes)).toBe('Crédito');
  });
});

describe('normalizeDescription', () => {
  it('remove acento, data, prefixo e códigos longos', () => {
    expect(
      normalizeDescription('COMPRA CARTAO Padaria São João 22/10 123456789'),
    ).toBe('PADARIA SAO JOAO');
  });
});

describe('addDedupeKeys', () => {
  const a = { date: '2026-10-22', amountCents: -1000, description: 'Café' };

  it('usa o FITID quando existe', () => {
    expect(addDedupeKeys('cc', [{ ...a, externalId: 'X1' }])[0].dedupeKey).toBe(
      'f:cc:X1',
    );
  });
  it('compras idênticas no mesmo dia ganham sequência diferente', () => {
    const [k1, k2] = addDedupeKeys('cc', [a, a]);
    expect(k1.dedupeKey).not.toBe(k2.dedupeKey);
  });
  it('reimportar o mesmo arquivo gera as mesmas chaves', () => {
    const run = () =>
      addDedupeKeys(
        'cc',
        parseOfx(decodeBytes(fx('conta-sgml.ofx'))).transactions,
      ).map((t) => t.dedupeKey);
    expect(run()).toEqual(run());
  });
  it('hashKey devolve 64 hex', async () =>
    expect(await hashKey('f:cc:X1')).toMatch(/^[0-9a-f]{64}$/));
});
