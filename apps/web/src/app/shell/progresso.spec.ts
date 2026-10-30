import { Progresso } from './progresso';

describe('Progresso', () => {
  it('fica ativo enquanto houver tarefas pendentes', async () => {
    const p = new Progresso();
    expect(p.ativo()).toBe(false);
    p.iniciar();
    p.iniciar();
    p.concluir();
    expect(p.ativo()).toBe(true);
    p.concluir();
    expect(p.ativo()).toBe(false);
  });

  it('não fica negativo e conclui mesmo com erro', async () => {
    const p = new Progresso();
    p.concluir();
    await expect(
      p.acompanhar(Promise.reject(new Error('x'))),
    ).rejects.toThrow();
    expect(p.ativo()).toBe(false);
  });
});
