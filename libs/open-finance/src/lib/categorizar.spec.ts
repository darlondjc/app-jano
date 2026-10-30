import { addDedupeKeys } from '@jano/import-file';
import { categorizar } from './categorizar';

const categorias = [
  { id: 'mercado', name: 'Supermercado' },
  { id: 'restaurantes', name: 'Restaurantes' },
  { id: 'lazer', name: 'Lazer' },
];

function rows(...descriptions: string[]) {
  return addDedupeKeys(
    'conta',
    descriptions.map((description) => ({
      date: '2026-10-01',
      amountCents: -1000,
      description,
    })),
  );
}

describe('categorizar', () => {
  it('regra do usuário vence o dicionário', () => {
    const [r] = categorizar(rows('IFOOD *LOJA'), categorias, [
      { pattern: 'IFOOD', categoryId: 'lazer' },
    ]);
    expect(r.categoryId).toBe('lazer');
  });

  it('dicionário padrão acha a categoria renomeada pelo id', () => {
    const [r] = categorizar(rows('CARREFOUR 123'), categorias, []);
    expect(r.categoryId).toBe('mercado');
  });

  it('categoria que não existe na conta fica sem categoria', () => {
    const [r] = categorizar(rows('UBER TRIP'), categorias, []);
    expect(r.categoryId).toBeNull();
  });

  it('transferência detectada pela descrição fica sem categoria', () => {
    const [r] = categorizar(rows('PAGAMENTO FATURA CARTAO'), categorias, []);
    expect(r.tx.isTransfer).toBe(true);
    expect(r.categoryId).toBeNull();
  });
});
