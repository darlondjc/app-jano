import { SPLASH_FULL_MS, SPLASH_REDUCED_MS } from '@jano/ui';
import {
  lerContextoSplash,
  marcarSplashVista,
  pedirSplash,
  splashDuracao,
} from './splash';

describe('splashDuracao', () => {
  it('não toca de novo na mesma sessão', () => {
    expect(splashDuracao({ jaVista: true, movimentoReduzido: false })).toBe(0);
  });
  it('toca completa por padrão', () => {
    expect(splashDuracao({ jaVista: false, movimentoReduzido: false })).toBe(
      SPLASH_FULL_MS,
    );
  });
  it('encurta com movimento reduzido', () => {
    expect(splashDuracao({ jaVista: false, movimentoReduzido: true })).toBe(
      SPLASH_REDUCED_MS,
    );
  });
});

describe('pedirSplash', () => {
  it('faz a splash tocar de novo no próximo carregamento', () => {
    marcarSplashVista();
    expect(lerContextoSplash().jaVista).toBe(true);
    pedirSplash();
    expect(lerContextoSplash().jaVista).toBe(false);
  });
});
