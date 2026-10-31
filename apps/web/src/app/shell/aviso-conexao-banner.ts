import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuthService,
  CacheLocal,
  ConnectionsRepository,
} from '@jano/data-access';
import { JanoBanner } from '@jano/ui';
import { avisoConexao, avisoOffline, type AvisoConexao } from './aviso-conexao';

/**
 * Banner do topo de todas as telas: sem conexão (dados guardados no aparelho) ou, com
 * internet, consentimento e sincronização do Open Finance. Um só, o mais urgente.
 */
@Component({
  selector: 'jano-aviso-conexao',
  imports: [JanoBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .aviso {
      max-width: 1280px;
      margin: 0 auto;
      padding: 16px 16px 0;
    }
    a {
      margin-left: 4px;
      font-weight: 600;
      color: inherit;
    }
  `,
  template: `
    @if (aviso(); as a) {
      <div class="aviso">
        <jano-banner [tone]="a.tom" [title]="a.titulo">
          {{ a.texto }}
          @if (a.acao; as acao) {
            <a [href]="acao.href" target="_blank" rel="noopener">{{
              acao.rotulo
            }}</a>
          }
        </jano-banner>
      </div>
    }
  `,
})
export class AvisoConexaoBanner {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ConnectionsRepository);
  private readonly cache = inject(CacheLocal);
  private readonly conexao = signal<AvisoConexao | null>(null);
  protected readonly aviso = computed(() => {
    const desde = this.cache.offlineDesde();
    return desde ? avisoOffline(desde) : this.conexao();
  });

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    // Aviso é complemento: se a leitura falhar, a tela segue sem ele.
    const conexoes = await this.repo.list(uid).catch(() => []);
    this.conexao.set(avisoConexao(conexoes));
  }
}
