import { gerarDadosDemo } from '@jano/data-access';
import { detectarSalario } from './salario';

describe('detectarSalario', () => {
  const dados = gerarDadosDemo(new Date(2026, 10, 1, 9));
  const cartoes = new Set(['cartao-de-credito']);

  it('reconhece a maior entrada recorrente, o dia e as chegadas', () => {
    const s = detectarSalario(dados.transactions, cartoes)!;
    expect(s.dia).toBe(5);
    expect(s.nome).toBe('Salario Empresa Exemplo Ltda');
    expect(s.chegadas).toContain('2026-10-05');
    // O empréstimo ou um Pix grande isolado não entram: só o que se repete.
    expect(s.chegadas.every((d) => d.endsWith('-05'))).toBe(true);
  });

  it('sem entrada recorrente, sem salário', () => {
    expect(
      detectarSalario(
        dados.transactions.filter((t) => t.amountCents < 0),
        cartoes,
      ),
    ).toBeNull();
  });
});
