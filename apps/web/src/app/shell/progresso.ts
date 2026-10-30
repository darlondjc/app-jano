import { Injectable, computed, signal } from '@angular/core';

/**
 * Contador de tarefas em andamento: a barra de progresso do topo fica visível
 * enquanto houver alguma. Use `acompanhar(promessa)` em carregamentos de dados.
 */
@Injectable({ providedIn: 'root' })
export class Progresso {
  private readonly pendentes = signal(0);
  readonly ativo = computed(() => this.pendentes() > 0);

  iniciar(): void {
    this.pendentes.update((n) => n + 1);
  }

  concluir(): void {
    this.pendentes.update((n) => Math.max(0, n - 1));
  }

  async acompanhar<T>(tarefa: Promise<T>): Promise<T> {
    this.iniciar();
    try {
      return await tarefa;
    } finally {
      this.concluir();
    }
  }
}
