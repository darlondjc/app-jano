import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, ContaRepository } from '@jano/data-access';
import type { RegistroImportacao } from '@jano/data-access';
import { JanoButton, JanoSkeleton, JanoSkeletonGroup } from '@jano/ui';
import { BUILD_ID } from '../../environments/build-info';
import { AtualizacaoService } from '../versao/atualizacao.service';
import { VERSAO_ATUAL } from '../versao/changelog';
import { baixar, transacoesCsv } from './exportar';
import { Preferencias } from './preferencias';
import { haQuantoTempo } from './tempo';

/** Conta e dados: importação, atualização do app, privacidade e dados pessoais. */
@Component({
  selector: 'jano-conta',
  imports: [RouterLink, JanoButton, JanoSkeleton, JanoSkeletonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 8px 16px 48px;
    }
    h1 {
      margin: 0 0 4px;
      font: 600 28px/36px var(--font-sans);
    }
    h2 {
      margin: 0 0 4px;
      font: 600 18px/24px var(--font-sans);
    }
    section {
      margin-top: 16px;
    }
    .linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .acoes {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    p {
      margin: 0;
      color: var(--text-2);
      font: 400 14px/20px var(--font-sans);
    }
    .ok {
      color: var(--success-text, var(--primary-text));
    }
    .chave {
      flex: none;
      width: 44px;
      height: 26px;
      padding: 2px;
      border: 0;
      border-radius: 13px;
      background: var(--border-strong);
      cursor: pointer;
      transition: background 150ms ease;
    }
    .chave[aria-checked='true'] {
      background: var(--primary);
    }
    .chave span {
      display: block;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      transition: transform 150ms ease;
    }
    .chave[aria-checked='true'] span {
      transform: translateX(18px);
    }
    .chave:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .perigo {
      border-color: var(--danger-border, var(--border-strong));
    }
    .confirma {
      margin-top: 12px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .confirma input {
      width: 160px;
    }
  `,
  template: `
    <h1>Conta e dados</h1>
    <div class="j-sub">{{ email() }}</div>

    <section class="j-card">
      <h2>Importação</h2>
      @if (carregandoImp()) {
        <jano-skeleton-group label="Verificando importações">
          <jano-skeleton w="70%" h="14px" />
        </jano-skeleton-group>
      } @else if (ultima(); as u) {
        <p>
          Última importação {{ quando(u.createdAt) }}: {{ u.fileName }} ({{
            u.added
          }}
          novas, {{ u.duplicates }} repetidas).
        </p>
      } @else {
        <p>Você ainda não importou nenhum arquivo.</p>
      }
      <div class="acoes">
        <a janoButton routerLink="/transacoes">Importar novo extrato</a>
      </div>
    </section>

    <section class="j-card">
      <h2>Atualização do app</h2>
      <p>
        Versão instalada: {{ versao }}
        @if (emDesenvolvimento) {
          (desenvolvimento)
        }
      </p>
      @if (atualizacao.disponivel(); as v) {
        <p class="ok">
          Nova versão disponível{{ v.version ? ' (' + v.version + ')' : '' }}.
        </p>
      } @else if (resultado() === 'atual') {
        <p class="ok">Você está na versão mais recente.</p>
      } @else if (resultado() === 'erro') {
        <p>Não foi possível consultar agora. Tente de novo em instantes.</p>
      }
      <div class="acoes">
        @if (atualizacao.disponivel()) {
          <button
            janoButton
            type="button"
            [disabled]="atualizacao.estado() === 'aplicando'"
            (click)="atualizacao.atualizar()"
          >
            {{
              atualizacao.estado() === 'aplicando'
                ? 'Atualizando…'
                : 'Atualizar agora'
            }}
          </button>
        } @else {
          <button
            janoButton
            variant="secondary"
            type="button"
            [disabled]="verificando()"
            (click)="verificar()"
          >
            {{ verificando() ? 'Verificando…' : 'Verificar atualização' }}
          </button>
        }
        <a janoButton variant="ghost" routerLink="/novidades">Novidades</a>
      </div>
    </section>

    <section class="j-card">
      <div class="linha">
        <div>
          <h2 id="rot-ocultar">Ocultar valores</h2>
          <p>Troca os valores em reais por uma máscara neste aparelho.</p>
        </div>
        <button
          class="chave"
          type="button"
          role="switch"
          aria-labelledby="rot-ocultar"
          [attr.aria-checked]="prefs.ocultarValores()"
          (click)="prefs.alternarOcultarValores()"
        >
          <span></span>
        </button>
      </div>
    </section>

    <section class="j-card">
      <h2>Seus dados</h2>
      <p>
        Baixe uma cópia do que está guardado: transações em planilha (CSV) ou
        tudo em JSON.
      </p>
      <div class="acoes">
        <button
          janoButton
          variant="secondary"
          type="button"
          [disabled]="ocupado()"
          (click)="exportar('csv')"
        >
          Exportar transações (CSV)
        </button>
        <button
          janoButton
          variant="secondary"
          type="button"
          [disabled]="ocupado()"
          (click)="exportar('json')"
        >
          Exportar tudo (JSON)
        </button>
      </div>
      @if (aviso()) {
        <p role="status" style="margin-top: 12px">{{ aviso() }}</p>
      }
    </section>

    <section class="j-card perigo">
      <h2>Apagar todos os dados</h2>
      <p>
        Remove transações, categorias, metas, regras e histórico de importações.
        Não dá para desfazer; exporte antes se quiser guardar uma cópia.
      </p>
      @if (!confirmando()) {
        <div class="acoes">
          <button
            janoButton
            variant="danger"
            type="button"
            (click)="confirmando.set(true)"
          >
            Apagar tudo…
          </button>
        </div>
      } @else {
        <div class="confirma">
          <label for="conf" class="j-cap">Digite APAGAR para confirmar</label>
          <input
            id="conf"
            class="j-input"
            autocomplete="off"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
          />
          <button
            janoButton
            variant="danger"
            type="button"
            [disabled]="texto().trim().toUpperCase() !== 'APAGAR' || ocupado()"
            (click)="apagar()"
          >
            Apagar definitivamente
          </button>
          <button janoButton variant="ghost" type="button" (click)="cancelar()">
            Cancelar
          </button>
        </div>
      }
    </section>
  `,
})
export class Conta {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ContaRepository);
  protected readonly atualizacao = inject(AtualizacaoService);
  protected readonly prefs = inject(Preferencias);

  protected readonly versao = VERSAO_ATUAL;
  protected readonly emDesenvolvimento = BUILD_ID === 'dev';
  protected readonly ultima = signal<RegistroImportacao | null>(null);
  protected readonly carregandoImp = signal(true);
  protected readonly verificando = signal(false);
  protected readonly resultado = signal<'atual' | 'nova' | 'erro' | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal('');
  protected readonly confirmando = signal(false);
  protected readonly texto = signal('');

  constructor() {
    void this.carregar();
  }

  protected email(): string {
    return this.auth.user()?.email ?? '';
  }

  protected quando(iso: string): string {
    return haQuantoTempo(iso);
  }

  private async carregar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    try {
      if (uid) this.ultima.set(await this.repo.ultimaImportacao(uid));
    } catch {
      this.ultima.set(null);
    } finally {
      this.carregandoImp.set(false);
    }
  }

  protected async verificar(): Promise<void> {
    this.verificando.set(true);
    this.resultado.set(await this.atualizacao.verificar());
    this.verificando.set(false);
  }

  protected async exportar(formato: 'csv' | 'json'): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    this.ocupado.set(true);
    this.aviso.set('');
    try {
      const dados = await this.repo.exportar(uid);
      const dia = new Date().toISOString().slice(0, 10);
      if (formato === 'csv')
        baixar(
          `jano-transacoes-${dia}.csv`,
          transacoesCsv(dados),
          'text/csv;charset=utf-8',
        );
      else
        baixar(
          `jano-dados-${dia}.json`,
          JSON.stringify(dados, null, 2),
          'application/json',
        );
      this.aviso.set('Arquivo gerado. Veja a pasta de downloads.');
    } catch {
      this.aviso.set('Não foi possível exportar agora. Tente de novo.');
    } finally {
      this.ocupado.set(false);
    }
  }

  protected cancelar(): void {
    this.confirmando.set(false);
    this.texto.set('');
  }

  protected async apagar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    this.ocupado.set(true);
    try {
      const n = await this.repo.apagarTudo(uid);
      this.ultima.set(null);
      this.aviso.set(`Pronto: ${n} registros apagados.`);
      this.cancelar();
    } catch {
      this.aviso.set('Não foi possível apagar tudo. Tente de novo.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
