import { SPLASH_FULL_MS, SPLASH_REDUCED_MS } from '@jano/ui';

const FLAG = 'jano.splash.vista';

/**
 * A splash toca uma vez por sessão do navegador (não a cada navegação) e dura o
 * suficiente para a animação terminar; com movimento reduzido, só um instante.
 */
export function splashDuracao(opts: {
  jaVista: boolean;
  movimentoReduzido: boolean;
}): number {
  if (opts.jaVista) return 0;
  return opts.movimentoReduzido ? SPLASH_REDUCED_MS : SPLASH_FULL_MS;
}

export function lerContextoSplash(): {
  jaVista: boolean;
  movimentoReduzido: boolean;
} {
  let jaVista = false;
  try {
    jaVista = sessionStorage.getItem(FLAG) === '1';
  } catch {
    /* armazenamento indisponível: toca a splash normalmente */
  }
  const movimentoReduzido =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { jaVista, movimentoReduzido };
}

export function marcarSplashVista(): void {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

/** Faz a splash tocar no próximo carregamento (ao atualizar o app para a versão nova). */
export function pedirSplash(): void {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* sem armazenamento: a splash já toca em todo carregamento */
  }
}
