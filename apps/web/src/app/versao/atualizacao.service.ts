import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BUILD_ID } from '../../environments/build-info';
import { pedirSplash } from '../splash';

const INTERVALO_MS = 5 * 60 * 1000;
/** Se ativar a versão nova demorar mais que isso, recarrega mesmo assim. */
const LIMITE_ATUALIZAR_MS = 8000;

export interface VersaoNova {
  buildId: string;
  version: string;
  /** Principal novidade, do topo do changelog publicado. */
  novidade?: string;
}

/**
 * Descobre se há versão nova publicada: compara o BUILD_ID embutido neste bundle
 * com o /version.json do servidor (sempre buscado sem cache). Ao achar, já baixa a versão
 * nova em segundo plano, para "Atualizar" só precisar ativar e recarregar.
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoService {
  readonly disponivel = signal<VersaoNova | null>(null);
  /** baixando: o service worker ainda busca os arquivos; pronta: falta só ativar; aplicando: ativando e recarregando. */
  readonly estado = signal<'baixando' | 'pronta' | 'aplicando'>('baixando');
  /** "Depois": esconde o aviso dessa versão até recarregar o app. */
  readonly dispensada = signal<string | null>(null);
  private iniciado = false;
  private baixando: Promise<void> | null = null;
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
      const info = (await r.json()) as Partial<VersaoNova>;
      if (info.buildId && info.buildId !== BUILD_ID) {
        this.disponivel.set({
          buildId: info.buildId,
          version: info.version ?? '',
          ...(info.novidade ? { novidade: info.novidade } : {}),
        });
        void this.baixar();
        return 'nova';
      }
      return 'atual';
    } catch {
      // Sem rede ou arquivo ausente: tenta de novo no próximo ciclo.
      return 'erro';
    }
  }

  dispensar(): void {
    this.dispensada.set(this.disponivel()?.buildId ?? null);
  }

  /** Baixa a versão nova no service worker, uma vez; sem ele, não há o que baixar. */
  private baixar(): Promise<void> {
    this.baixando ??= (async () => {
      try {
        if (this.sw?.isEnabled) await this.sw.checkForUpdate();
      } catch {
        // Falhou o download: "Atualizar" tenta de novo.
        this.baixando = null;
        return;
      }
      if (this.estado() === 'baixando') this.estado.set('pronta');
    })();
    return this.baixando;
  }

  /**
   * Troca para a versão nova e recarrega. Com o service worker ativo, é ele quem guarda o
   * app: a versão nova precisa estar baixada e ativada, senão o recarregamento serve a
   * antiga. Normalmente já está baixada (ver `baixar`); se travar, recarrega no limite.
   */
  async atualizar(): Promise<void> {
    if (this.estado() === 'aplicando') return;
    this.estado.set('aplicando');
    const trocar = async () => {
      try {
        if (this.sw?.isEnabled) {
          await this.baixar();
          await this.sw.activateUpdate();
        } else {
          await fetch(document.baseURI, { cache: 'reload' });
        }
      } catch {
        // Recarregar mesmo assim.
      }
    };
    await Promise.race([
      trocar(),
      new Promise((ok) => setTimeout(ok, LIMITE_ATUALIZAR_MS)),
    ]);
    // A versão nova abre com a splash, como quando o app é aberto.
    pedirSplash();
    location.reload();
  }
}
