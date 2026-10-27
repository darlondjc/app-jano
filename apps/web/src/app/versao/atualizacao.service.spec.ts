import { AtualizacaoService } from './atualizacao.service';
import { VERSAO_ATUAL } from './changelog';

describe('AtualizacaoService', () => {
  it('em desenvolvimento não consulta o servidor', () => {
    const s = new AtualizacaoService();
    s.iniciar();
    expect(s.disponivel()).toBeNull();
  });

  it('detecta build diferente', async () => {
    const s = new AtualizacaoService();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ buildId: 'novo', version: '9.9.9' }),
      }),
    );
    await s.verificar();
    expect(s.disponivel()).toEqual({ buildId: 'novo', version: '9.9.9' });
    vi.unstubAllGlobals();
  });

  it('versão atual vem do topo do changelog', () => {
    expect(VERSAO_ATUAL).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
