import { Injectable, effect, signal } from '@angular/core';
import { valoresOcultos } from '@jano/engine';

const CHAVE = 'jano.ocultarValores';
const CHAVE_SALDO = 'jano.saldoInicial';

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function lerSaldo(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_SALDO));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Preferências por aparelho (guardadas no navegador). */
@Injectable({ providedIn: 'root' })
export class Preferencias {
  readonly ocultarValores = valoresOcultos;
  /** Saldo informado para a projeção, em centavos (0 = não informado). Fica só neste aparelho. */
  readonly saldoInicial = signal(lerSaldo());

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

  definirSaldoInicial(cents: number): void {
    this.saldoInicial.set(cents);
    try {
      localStorage.setItem(CHAVE_SALDO, String(cents));
    } catch {
      // Sem armazenamento: vale só nesta sessão.
    }
  }

  alternarOcultarValores(): void {
    valoresOcultos.update((v) => !v);
  }
}
