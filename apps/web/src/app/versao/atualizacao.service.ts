import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BUILD_ID } from '../../environments/build-info';

const INTERVALO_MS = 5 * 60 * 1000;

/**
 * Descobre se há versão nova publicada: compara o BUILD_ID embutido neste bundle
 * com o /version.json do servidor (sempre buscado sem cache).
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoService {
  readonly disponivel = signal<{ buildId: string; version: string } | null>(
    null,
  );
  private iniciado = false;
  private readonly sw = inject(SwUpdate, { optional: true });

  iniciar(): void {
    if (this.iniciado || BUILD_ID === 'dev') return;
    this.iniciado = true;
    void this.verificar();
    setInterval(() => void this.verificar(), INTERVALO_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.verificar();
    });
  }

  /** Consulta o servidor agora. "erro" = sem rede ou sem version.json (ex.: em desenvolvimento). */
  async verificar(): Promise<'atual' | 'nova' | 'erro'> {
    try {
      const url = new URL('version.json', document.baseURI);
      url.searchParams.set('t', String(Date.now()));
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return 'erro';
      const info = (await r.json()) as { buildId?: string; version?: string };
      if (info.buildId && info.buildId !== BUILD_ID) {
        this.disponivel.set({
          buildId: info.buildId,
          version: info.version ?? '',
        });
        return 'nova';
      }
      return 'atual';
    } catch {
      // Sem rede ou arquivo ausente: tenta de novo no próximo ciclo.
      return 'erro';
    }
  }

  /**
   * Troca para a versão nova e recarrega. Com o service worker ativo, é ele quem guarda o
   * app: precisa baixar e ativar a versão nova antes, senão o recarregamento serve a antiga.
   */
  async atualizar(): Promise<void> {
    try {
      if (this.sw?.isEnabled) {
        await this.sw.checkForUpdate();
        await this.sw.activateUpdate();
      } else {
        await fetch(document.baseURI, { cache: 'reload' });
      }
    } catch {
      // Recarregar mesmo assim.
    }
    location.reload();
  }
}
