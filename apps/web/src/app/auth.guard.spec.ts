import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { authGuard } from './auth.guard';

function run(state: 'logado' | 'deslogado') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { whenReady: async () => undefined, state: () => state },
      },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    authGuard({} as never, {} as never),
  );
}

describe('authGuard', () => {
  it('libera quem está logado', async () => {
    expect(await run('logado')).toBe(true);
  });
  it('manda quem não está logado para /entrar (injeção correta mesmo após await)', async () => {
    const r = (await run('deslogado')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(r)).toBe('/entrar');
  });
});
