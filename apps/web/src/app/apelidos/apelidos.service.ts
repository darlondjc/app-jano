import { Injectable, Injector, inject, signal } from '@angular/core';
import {
  ApelidosRepository,
  AuthService,
  type ApelidoDoc,
} from '@jano/data-access';
import { apelidoDe, definirApelidos } from '@jano/import-file';

/**
 * Apelidos do usuário ("JIM DAVI" → "Academia"): carregados uma vez por sessão e ligados ao
 * `nomeDeExibicao`, então valem em todas as telas, para o passado e o futuro, sem regravar
 * nenhuma transação.
 */
@Injectable({ providedIn: 'root' })
export class ApelidosService {
  // Resolvido na hora do uso: sem Firebase (testes), a tela segue sem apelidos.
  private readonly injector = inject(Injector);
  private get repo(): ApelidosRepository {
    return this.injector.get(ApelidosRepository);
  }
  private get auth(): AuthService {
    return this.injector.get(AuthService);
  }
  private carregando: Promise<void> | null = null;

  readonly lista = signal<ApelidoDoc[]>([]);

  garantir(): Promise<void> {
    this.carregando ??= this.carregar();
    return this.carregando;
  }

  /** O apelido que vale para a descrição, com o id para trocar ou remover. */
  doLancamento(description: string): ApelidoDoc | null {
    const a = apelidoDe(description);
    return a ? (this.lista().find((x) => x.id === a.id) ?? null) : null;
  }

  async salvar(pattern: string, apelido: string): Promise<void> {
    const uid = this.uid();
    const novo = await this.repo.save(uid, pattern, apelido);
    this.aplicar([...this.lista().filter((a) => a.id !== novo.id), novo]);
  }

  async remover(id: string): Promise<void> {
    await this.repo.remove(this.uid(), id);
    this.aplicar(this.lista().filter((a) => a.id !== id));
  }

  private async carregar(): Promise<void> {
    try {
      const uid = this.auth.user()?.uid;
      if (!uid) return;
      this.aplicar(await this.repo.list(uid));
    } catch {
      // Sem apelidos agora: os nomes do banco continuam; tenta de novo depois.
      this.carregando = null;
    }
  }

  private aplicar(lista: ApelidoDoc[]): void {
    this.lista.set(lista);
    definirApelidos(lista);
  }

  private uid(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    return u.uid;
  }
}
