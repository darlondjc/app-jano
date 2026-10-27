import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Tempo mínimo (ms) para a animação da chave terminar de desenhar e o nome aparecer. */
export const SPLASH_FULL_MS = 2600;
export const SPLASH_REDUCED_MS = 600;

/** Splash animada: a chave de duas faces se desenha, depois entram nome e slogan. */
@Component({
  selector: 'jano-splash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: block;
    }
    .splash {
      height: 100%;
      background: var(--primary);
      color: var(--on-primary);
      font-family: var(--font-sans);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      position: relative;
    }
    svg {
      width: 88px;
      height: 141px;
      display: block;
    }
    .nome {
      font: 600 56px/1 var(--font-sans);
      letter-spacing: -0.03em;
      color: #fff;
      text-align: center;
    }
    .slogan {
      margin-top: 12px;
      font: 500 16px/24px var(--font-sans);
      color: #fff;
      opacity: 0.9;
      text-align: center;
      padding: 0 24px;
    }
    .barra {
      position: absolute;
      bottom: 72px;
      width: 96px;
      height: 4px;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    .barra i {
      display: block;
      width: 40%;
      height: 100%;
      border-radius: 99px;
      background: var(--on-primary);
      animation: jbar 1.4s ease-in-out 2.6s infinite;
    }
    .k-ring,
    .k-stem,
    .k-teeth {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
    }
    .k-ring {
      animation: jdraw 0.7s ease-out 0.2s forwards;
    }
    .k-stem {
      animation: jdraw 0.5s ease-out 0.85s forwards;
    }
    .k-teeth {
      animation: jdraw 0.6s ease-out 1.25s forwards;
    }
    .k-name,
    .k-tag,
    .barra {
      opacity: 0;
    }
    .k-name {
      animation: jrise 0.6s ease-out 1.7s forwards;
    }
    .k-tag {
      animation: jrise 0.6s ease-out 2.1s forwards;
    }
    .barra {
      animation: jrise 0.4s ease-out 2.4s forwards;
    }
    @keyframes jdraw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes jrise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @keyframes jbar {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(250%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .k-ring,
      .k-stem,
      .k-teeth {
        animation: none;
        stroke-dashoffset: 0;
      }
      .k-name,
      .k-tag,
      .barra {
        animation: none;
        opacity: 1;
      }
      .barra i {
        animation: none;
        transform: translateX(75%);
      }
    }
  `,
  template: `
    <div class="splash" role="status" aria-live="polite">
      <svg
        viewBox="12 0 40 64"
        role="img"
        aria-label="Símbolo do Jano: uma chave de duas faces"
      >
        <circle
          class="k-ring"
          pathLength="1"
          cx="32"
          cy="15"
          r="9"
          fill="none"
          stroke="#fff"
          stroke-width="5"
        />
        <path
          class="k-stem"
          pathLength="1"
          d="M32 24 V58"
          fill="none"
          stroke="#fff"
          stroke-width="5"
          stroke-linecap="round"
        />
        <path
          class="k-teeth"
          pathLength="1"
          d="M32 42 H19 M32 52 H25 M32 42 H45 M32 52 H39"
          fill="none"
          stroke="#fff"
          stroke-width="5"
          stroke-linecap="round"
        />
      </svg>
      <div>
        <div class="nome k-name">jano</div>
        <div class="slogan k-tag">Veja o que passou. Planeje o que vem.</div>
      </div>
      <div class="barra" role="progressbar" aria-label="Carregando">
        <i></i>
      </div>
    </div>
  `,
})
export class JanoSplash {}
