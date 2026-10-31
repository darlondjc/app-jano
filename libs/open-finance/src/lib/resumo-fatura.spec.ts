import { addDedupeKeys } from '@jano/import-file';
import { categorizar } from './categorizar';
import { inicioDaFaturaAberta, resumirFatura } from './resumo-fatura';

describe('resumirFatura', () => {
  const rows = categorizar(
    addDedupeKeys('cartao', [
      {
        date: '2026-10-05',
        amountCents: -18000,
        description: 'MATEUS SUPERMERCADOS',
      },
      {
        date: '2026-10-09',
        amountCents: -6000,
        description: 'IFOOD *RESTAURANTE',
      },
      { date: '2026-10-12', amountCents: -5590, description: 'NETFLIX.COM' },
      {
        date: '2026-10-14',
        amountCents: 2000,
        description: 'ESTORNO MATEUS SUPERMERCADOS',
      },
      {
        date: '2026-10-20',
        amountCents: 300000,
        description: 'PAGAMENTO RECEBIDO',
        isTransfer: true,
      },
      {
        date: '2026-09-30',
        amountCents: -99999,
        description: 'ANTES DO PERIODO',
      },
    ]),
    [
      { id: 'mercado', name: 'Mercado' },
      { id: 'restaurantes', name: 'Restaurantes' },
      { id: 'assinaturas', name: 'Assinaturas' },
    ],
    [],
  );

  it('total com estorno, por categoria, maiores; fora transferência e o que é antes', () => {
    const r = resumirFatura(rows, '2026-10-01');
    expect(r.totalCents).toBe(18000 + 6000 + 5590 - 2000);
    expect(r.compras).toBe(3);
    expect(r.porCategoria).toEqual([
      { categoryId: 'mercado', cents: 16000 },
      { categoryId: 'restaurantes', cents: 6000 },
      { categoryId: 'assinaturas', cents: 5590 },
    ]);
    expect(r.maiores.map((m) => m.nome)).toEqual([
      'MATEUS SUPERMERCADOS',
      'IFOOD *RESTAURANTE',
      'NETFLIX.COM',
    ]);
  });
});

describe('inicioDaFaturaAberta', () => {
  it('fecha no futuro: começa depois do fechamento anterior', () => {
    expect(inicioDaFaturaAberta('2026-11-27', '2026-10-31')).toBe('2026-10-28');
  });
  it('já fechou: começa no dia seguinte', () => {
    expect(inicioDaFaturaAberta('2026-10-27', '2026-10-31')).toBe('2026-10-28');
  });
  it('sem data do banco: últimos 30 dias', () => {
    expect(inicioDaFaturaAberta(null, '2026-10-31')).toBe('2026-10-01');
  });
});
