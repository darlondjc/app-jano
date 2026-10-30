import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { Preferencias } from '../conta/preferencias';

/** "Darlon Jose Costa" → "DC"; sem nome, usa a inicial do e-mail. */
export function iniciais(nome: string | null, email: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2)
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (email ?? '?').slice(0, 1).toUpperCase();
}

/** Avatar com as iniciais do usuário e o menu da conta. */
@Component({
  selector: 'jano-avatar-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      cursor: pointer;
      color: var(--on-primary, #fff);
      background: var(--primary);
      font: 600 14px/1 var(--font-sans);
      letter-spacing: 0.02em;
      position: relative;
    }
    .avatar:hover {
      background: var(--primary-hover, var(--primary));
    }
    .avatar:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .ponto {
      position: absolute;
      top: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--warning, #d97706);
      border: 2px solid var(--surface);
    }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      z-index: 60;
      min-width: 240px;
      padding: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sheet);
    }
    .quem {
      padding: 8px 12px 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 4px;
    }
    .quem b {
      display: block;
      font: 600 14px/20px var(--font-sans);
      color: var(--text);
    }
    .quem span {
      display: block;
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      cursor: pointer;
      text-decoration: none;
      color: var(--text);
      font: 500 14px/20px var(--font-sans);
      text-align: left;
      box-sizing: border-box;
    }
    .item:hover,
    .item:focus-visible {
      background: var(--surface-2);
      outline: none;
    }
    .item small {
      color: var(--text-2);
      font: 500 12px/16px var(--font-sans);
    }
    .novo {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
    }
  `,
  template: `
    <button
      #gatilho
      class="avatar"
      type="button"
      aria-haspopup="menu"
      [attr.aria-expanded]="aberto()"
      [attr.aria-label]="'Menu da conta de ' + nomeCompleto()"
      (click)="aberto.set(!aberto())"
    >
      {{ sigla() }}
      @if (novidades()) {
        <span class="ponto" aria-hidden="true"></span>
      }
    </button>
    @if (aberto()) {
      <div class="menu" role="menu" aria-label="Conta">
        <div class="quem">
          <b>{{ nomeCompleto() }}</b>
          <span>{{ email() }}</span>
        </div>
        <a class="item" role="menuitem" routerLink="/conta" (click)="fechar()"
          >Conta e dados</a
        >
        <a
          class="item"
          role="menuitem"
          routerLink="/novidades"
          (click)="fechar()"
        >
          Novidades
          @if (novidades()) {
            <span class="novo" aria-label="há novidades"></span>
          }
        </a>
        <button
          class="item"
          type="button"
          role="menuitemcheckbox"
          [attr.aria-checked]="prefs.ocultarValores()"
          (click)="prefs.alternarOcultarValores()"
        >
          Ocultar valores
          <small>{{ prefs.ocultarValores() ? 'ligado' : 'desligado' }}</small>
        </button>
        <button class="item" type="button" role="menuitem" (click)="sair()">
          Sair
        </button>
      </div>
    }
  `,
})
export class AvatarMenu {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly prefs = inject(Preferencias);

  /** Mostra o ponto de "há novidades" no avatar. */
  readonly novidades = input(false);

  protected readonly aberto = signal(false);
  protected readonly nomeCompleto = computed(
    () => this.auth.user()?.displayName ?? this.auth.user()?.email ?? 'Conta',
  );
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly sigla = computed(() =>
    iniciais(
      this.auth.user()?.displayName ?? null,
      this.auth.user()?.email ?? null,
    ),
  );

  protected fechar(): void {
    this.aberto.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected aoClicarFora(e: Event): void {
    if (this.aberto() && !this.el.nativeElement.contains(e.target as Node))
      this.fechar();
  }

  @HostListener('document:keydown.escape')
  protected aoEsc(): void {
    if (!this.aberto()) return;
    this.fechar();
    this.el.nativeElement.querySelector<HTMLElement>('.avatar')?.focus();
  }

  protected async sair(): Promise<void> {
    this.fechar();
    await this.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
