import { Injectable, effect } from '@angular/core';
import { valoresOcultos } from '@jano/engine';

const CHAVE = 'jano.ocultarValores';

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

/** Preferências por aparelho (guardadas no navegador). */
@Injectable({ providedIn: 'root' })
export class Preferencias {
  readonly ocultarValores = valoresOcultos;

  constructor() {
    valoresOcultos.set(ler());
    effect(() => {
      const v = valoresOcultos();
      try {
        localStorage.setItem(CHAVE, v ? '1' : '0');
      } catch {
        // Sem armazenamento: vale só nesta sessão.
      }
    });
  }

  alternarOcultarValores(): void {
    valoresOcultos.update((v) => !v);
  }
}
