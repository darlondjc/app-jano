import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AuthService, ConnectionsRepository } from '@jano/data-access';
import { JanoBanner } from '@jano/ui';
import { avisoConexao, type AvisoConexao } from './aviso-conexao';

/** Banner do Open Finance no topo de todas as telas: consentimento e sincronização. */
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
          <a [href]="a.acao.href" target="_blank" rel="noopener">{{
            a.acao.rotulo
          }}</a>
        </jano-banner>
      </div>
    }
  `,
})
export class AvisoConexaoBanner {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ConnectionsRepository);
  protected readonly aviso = signal<AvisoConexao | null>(null);

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    // Aviso é complemento: se a leitura falhar, a tela segue sem ele.
    const conexoes = await this.repo.list(uid).catch(() => []);
    this.aviso.set(avisoConexao(conexoes));
  }
}
