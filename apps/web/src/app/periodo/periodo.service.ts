import { Injectable, inject, signal } from '@angular/core';
import {
  AuthService,
  CatalogRepository,
  TransactionsRepository,
} from '@jano/data-access';
import {
  definirCalendario,
  diasRestantesNoPeriodo,
  periodoDe,
  previousMonths,
  ritmoDoPeriodo,
  rotuloDoPeriodo,
} from '@jano/engine';
import { calendarioDoHistorico } from './salario';
import { ApelidosService } from '../apelidos/apelidos.service';

/** Meses de histórico olhados para reconhecer o salário. */
const MESES_HISTORICO = 6;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Período financeiro do app: do salário até a véspera do próximo. Descobre o salário uma vez
 * por sessão, a partir do histórico (os meses fechados já ficam no aparelho), e liga o
 * calendário do engine. As telas chamam `garantir()` antes de carregar os dados.
 */
@Injectable({ providedIn: 'root' })
export class PeriodoService {
  private readonly auth = inject(AuthService);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly apelidos = inject(ApelidosService);
  private carregando: Promise<void> | null = null;

  /** Chave do período de hoje ('AAAA-MM'). */
  readonly atual = signal(isoLocal(new Date()).slice(0, 7));
  /** O período segue o salário (false = mês do calendário, sem salário reconhecido). */
  readonly peloSalario = signal(false);
  /** Salário reconhecido: nome como aparece no extrato e o dia de costume. */
  readonly salario = signal<{ nome: string; dia: number } | null>(null);

  /** Prepara o contexto da sessão: período financeiro e apelidos dos lançamentos. */
  garantir(): Promise<void> {
    this.carregando ??= Promise.all([
      this.descobrir(),
      this.apelidos.garantir(),
    ]).then(() => undefined);
    return this.carregando;
  }

  hoje(): string {
    return isoLocal(new Date());
  }

  rotulo(chave: string): string {
    return rotuloDoPeriodo(chave);
  }

  ritmo(chave: string): number {
    return ritmoDoPeriodo(chave, this.hoje());
  }

  diasRestantes(chave: string): number {
    return diasRestantesNoPeriodo(chave, this.hoje());
  }

  private async descobrir(): Promise<void> {
    const uid = this.auth.user()?.uid;
    const hoje = this.hoje();
    if (uid) {
      try {
        const mes = hoje.slice(0, 7);
        const [txs, contas] = await Promise.all([
          this.txRepo.listRange(
            uid,
            previousMonths(mes, MESES_HISTORICO).at(-1) as string,
            mes,
          ),
          this.catalog.accounts(uid),
        ]);
        const cartoes = new Set(
          contas.filter((c) => c.type === 'cartao').map((c) => c.id),
        );
        const r = calendarioDoHistorico(txs, cartoes);
        definirCalendario(r?.calendario ?? null);
        this.peloSalario.set(r !== null);
        this.salario.set(r ? { nome: r.nome, dia: r.dia } : null);
      } catch {
        // Sem histórico agora: fica o mês do calendário; tenta de novo na próxima sessão.
        definirCalendario(null);
        this.carregando = null;
      }
    }
    this.atual.set(periodoDe(hoje));
  }
}
