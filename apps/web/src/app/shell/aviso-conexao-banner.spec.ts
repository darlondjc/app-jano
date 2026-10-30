import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  ConnectionsRepository,
  type ConnectionDoc,
} from '@jano/data-access';
import { AvisoConexaoBanner } from './aviso-conexao-banner';
import { RENOVAR_URL } from './aviso-conexao';

function montar(conexoes: ConnectionDoc[]) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { user: () => ({ uid: 'u1' }) } },
      {
        provide: ConnectionsRepository,
        useValue: { list: vi.fn().mockResolvedValue(conexoes) },
      },
    ],
  });
  const f = TestBed.createComponent(AvisoConexaoBanner);
  return { f, el: f.nativeElement as HTMLElement };
}

describe('AvisoConexaoBanner', () => {
  it('mostra o aviso de renovação com o link para o Meu Pluggy', async () => {
    const { f, el } = montar([
      {
        id: 'item',
        provider: 'pluggy',
        name: 'MeuPluggy',
        status: 'UPDATED',
        errorCode: null,
        consentExpiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        bankUpdatedAt: null,
        syncedAt: new Date().toISOString(),
      },
    ]);
    await vi.waitFor(() => {
      f.detectChanges();
      expect(el.querySelector('jano-banner')).not.toBeNull();
    });
    expect(el.textContent).toContain('O consentimento expira em 5 dias.');
    expect(el.querySelector('a')?.getAttribute('href')).toBe(RENOVAR_URL);
  });

  it('sem conexão, não ocupa espaço', async () => {
    const { f, el } = montar([]);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(el.querySelector('.aviso')).toBeNull();
  });
});
