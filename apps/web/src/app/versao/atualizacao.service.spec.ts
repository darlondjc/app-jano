import { TestBed } from '@angular/core/testing';
import { AtualizacaoService } from './atualizacao.service';
import { VERSAO_ATUAL } from './changelog';

describe('AtualizacaoService', () => {
  it('em desenvolvimento não consulta o servidor', () => {
    const s = TestBed.inject(AtualizacaoService);
    s.iniciar();
    expect(s.disponivel()).toBeNull();
  });

  it('detecta build diferente', async () => {
    const s = TestBed.inject(AtualizacaoService);
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

  it('com service worker, ativa a versão nova antes de recarregar', async () => {
    const sw = {
      isEnabled: true,
      checkForUpdate: vi.fn().mockResolvedValue(true),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    const { SwUpdate } = await import('@angular/service-worker');
    TestBed.configureTestingModule({
      providers: [{ provide: SwUpdate, useValue: sw }],
    });
    // location.reload no jsdom só registra "não implementado"; o que importa é a ordem.
    await TestBed.inject(AtualizacaoService).atualizar();
    expect(sw.checkForUpdate).toHaveBeenCalled();
    expect(sw.activateUpdate).toHaveBeenCalled();
  });

  it('versão atual vem do topo do changelog', () => {
    expect(VERSAO_ATUAL).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
