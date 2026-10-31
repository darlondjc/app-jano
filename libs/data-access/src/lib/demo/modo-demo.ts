import {
  Injectable,
  computed,
  inject,
  signal,
  type Provider,
} from '@angular/core';
import type { User } from 'firebase/auth';
import type { KeyedTransaction } from '@jano/import-file';
import { AuthService, type AuthState } from '../firebase/auth.service';
import { BalancesRepository } from '../data/balances.repository';
import { BudgetsRepository, type BudgetDoc } from '../data/budgets.repository';
import { CatalogRepository } from '../data/catalog.repository';
import { ConnectionsRepository } from '../data/connections.repository';
import {
  ContaRepository,
  type DadosDoUsuario,
  type RegistroImportacao,
} from '../data/conta.repository';
import { InsightsRepository } from '../data/insights.repository';
import { RulesRepository, type RuleDoc } from '../data/rules.repository';
import {
  ScenariosRepository,
  type CenariosDoc,
} from '../data/scenarios.repository';
import { TransactionsRepository } from '../data/transactions.repository';
import {
  monthBounds,
  slugify,
  type CategoryDoc,
  type TransactionDoc,
} from '../data/models';
import { gerarDadosDemo } from './dados-demo';

const CHAVE = 'jano.demo';

/** O app abriu no modo demonstração (dados fictícios, nada vai ao servidor)? */
export function modoDemoAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

/** Liga ou desliga o modo demonstração e recarrega o app para trocar a fonte dos dados. */
export function definirModoDemo(ativo: boolean, destino = './'): void {
  try {
    if (ativo) localStorage.setItem(CHAVE, '1');
    else localStorage.removeItem(CHAVE);
  } catch {
    return;
  }
  location.assign(destino);
}

/** Dados da demonstração na memória: as telas podem editar, e tudo volta ao recarregar. */
@Injectable({ providedIn: 'root' })
export class LojaDemo {
  readonly dados = gerarDadosDemo();
  regras: RuleDoc[] = [];
  dispensados = new Map<string, string[]>();
  cenarios: CenariosDoc | null = null;

  alterar(ids: Iterable<string>, mudanca: Partial<TransactionDoc>): void {
    const alvo = new Set(ids);
    this.dados.transactions = this.dados.transactions.map((t) => {
      if (!alvo.has(t.id)) return t;
      const novo = { ...t, ...mudanca };
      if ('splits' in mudanca && mudanca.splits === undefined)
        delete novo.splits;
      return novo;
    });
  }
}

const copia = <T>(v: T): T => structuredClone(v);

class AuthDemo {
  private readonly _user = signal({
    uid: 'demo',
    displayName: 'Visitante',
    email: 'demonstracao@jano.app',
  } as unknown as User);
  readonly user = this._user.asReadonly();
  readonly state = computed<AuthState>(() => 'logado');
  async whenReady(): Promise<void> {
    return;
  }
  async signInWithGoogle(): Promise<void> {
    return;
  }
  async signOut(): Promise<void> {
    definirModoDemo(false);
  }
}

class TransacoesDemo {
  private readonly loja = inject(LojaDemo);
  private get txs() {
    return this.loja.dados.transactions;
  }
  async listMonth(_uid: string, month: string): Promise<TransactionDoc[]> {
    const { from, toExclusive } = monthBounds(month);
    return copia(
      this.txs.filter((t) => t.date >= from && t.date < toExclusive),
    );
  }
  async listRange(
    _uid: string,
    fromMonth: string,
    toMonth: string,
  ): Promise<TransactionDoc[]> {
    const from = monthBounds(fromMonth).from;
    const ate = monthBounds(toMonth).toExclusive;
    return copia(this.txs.filter((t) => t.date >= from && t.date < ate));
  }
  esquecer(): void {
    return;
  }
  async get(_uid: string, id: string): Promise<TransactionDoc | null> {
    return copia(this.txs.find((t) => t.id === id) ?? null);
  }
  async bulkUpdate(
    _uid: string,
    ids: string[],
    patch: Pick<
      TransactionDoc,
      'categoryId' | 'categoryIsManual' | 'isTransfer'
    >,
  ): Promise<void> {
    this.loja.alterar(ids, { ...patch, splits: undefined });
  }
  async existingKeys(): Promise<Set<string>> {
    return new Set(this.txs.map((t) => t.dedupeKey));
  }
  async commitImport(
    _uid: string,
    accountId: string,
    importId: string,
    rows: { tx: KeyedTransaction; categoryId: string | null }[],
  ): Promise<void> {
    for (const { tx, categoryId } of rows)
      this.loja.dados.transactions.unshift({
        id: tx.dedupeKey,
        accountId,
        date: tx.date,
        amountCents: tx.amountCents,
        description: tx.description,
        descriptionNorm: tx.descriptionNorm,
        dedupeKey: tx.dedupeKey,
        categoryId,
        categoryIsManual: false,
        isTransfer: tx.isTransfer ?? false,
        importId,
      });
  }
  async setCategory(
    _uid: string,
    id: string,
    categoryId: string | null,
  ): Promise<void> {
    this.loja.alterar([id], {
      categoryId,
      categoryIsManual: true,
      isTransfer: false,
      splits: undefined,
    });
  }
  async setSplits(
    _uid: string,
    id: string,
    splits: { categoryId: string; amountCents: number }[],
  ): Promise<string> {
    const principal = [...splits].sort(
      (a, b) => a.amountCents - b.amountCents,
    )[0].categoryId;
    this.loja.alterar([id], {
      splits,
      categoryId: principal,
      categoryIsManual: true,
      isTransfer: false,
    });
    return principal;
  }
  async aplicarAsPassadas(
    _uid: string,
    pattern: string,
    categoryId: string,
  ): Promise<string[]> {
    const ids = this.txs
      .filter(
        (t) =>
          t.descriptionNorm.includes(pattern) &&
          !t.isTransfer &&
          !t.splits?.length,
      )
      .map((t) => t.id);
    this.loja.alterar(ids, { categoryId, categoryIsManual: true });
    return ids;
  }
  async confirmar(_uid: string, ids: string[]): Promise<void> {
    this.loja.alterar(ids, { categoryIsManual: true });
  }
  async setTransfer(_uid: string, id: string): Promise<void> {
    this.loja.alterar([id], {
      categoryId: null,
      categoryIsManual: true,
      isTransfer: true,
      splits: undefined,
    });
  }
  async markTransfers(_uid: string, ids: string[]): Promise<void> {
    this.loja.alterar(ids, { isTransfer: true });
  }
}

class CatalogoDemo {
  private readonly loja = inject(LojaDemo);
  async accounts() {
    return copia(this.loja.dados.accounts);
  }
  async categories() {
    return copia(this.loja.dados.categories);
  }
  async saveCategory(
    _uid: string,
    cat: Omit<CategoryDoc, 'id' | 'position'> & {
      id?: string;
      position?: number;
    },
    existing: CategoryDoc[],
  ): Promise<string> {
    const lista = this.loja.dados.categories;
    const id = cat.id ?? slugify(cat.name);
    const position =
      cat.position ??
      existing.reduce((m, c) => Math.max(m, c.position), -1) + 1;
    const nova = { ...cat, id, position, name: cat.name.trim() };
    const i = lista.findIndex((c) => c.id === id);
    if (i >= 0) lista[i] = nova;
    else lista.push(nova);
    return id;
  }
  async addMissingDefaults(): Promise<number> {
    return 0;
  }
  async deleteCategory(_uid: string, id: string): Promise<void> {
    this.loja.dados.categories = this.loja.dados.categories.filter(
      (c) => c.id !== id,
    );
    this.loja.alterar(
      this.loja.dados.transactions
        .filter((t) => t.categoryId === id)
        .map((t) => t.id),
      { categoryId: null, categoryIsManual: true },
    );
  }
  async saveImportRecord(): Promise<void> {
    return;
  }
}

class OrcamentoDemo {
  private readonly loja = inject(LojaDemo);
  async list(): Promise<BudgetDoc[]> {
    return copia(this.loja.dados.budgets);
  }
  async save(
    _uid: string,
    categoryId: string,
    limitCents: number,
    rollover = false,
  ): Promise<void> {
    const lista = this.loja.dados.budgets.filter(
      (b) => b.categoryId !== categoryId,
    );
    this.loja.dados.budgets = [...lista, { categoryId, limitCents, rollover }];
  }
  async remove(_uid: string, categoryId: string): Promise<void> {
    this.loja.dados.budgets = this.loja.dados.budgets.filter(
      (b) => b.categoryId !== categoryId,
    );
  }
}

class RegrasDemo {
  private readonly loja = inject(LojaDemo);
  async list(): Promise<RuleDoc[]> {
    return copia(this.loja.regras);
  }
  async save(
    _uid: string,
    pattern: string,
    categoryId: string,
  ): Promise<RuleDoc> {
    const p = pattern.trim().toUpperCase();
    const regra = {
      id: `regra-${p}`,
      pattern: p,
      categoryId,
      createdAt: new Date().toISOString(),
    };
    this.loja.regras = [
      ...this.loja.regras.filter((r) => r.id !== regra.id),
      regra,
    ];
    return regra;
  }
}

class SaldosDemo {
  private readonly loja = inject(LojaDemo);
  async list() {
    return copia(this.loja.dados.balances);
  }
}

class ConexoesDemo {
  private readonly loja = inject(LojaDemo);
  async list() {
    return copia(this.loja.dados.connections);
  }
}

class InsightsDemo {
  private readonly loja = inject(LojaDemo);
  async dispensados(_uid: string, month: string): Promise<string[]> {
    return [...(this.loja.dispensados.get(month) ?? [])];
  }
  async dispensar(_uid: string, month: string, id: string): Promise<void> {
    this.loja.dispensados.set(month, [
      ...(this.loja.dispensados.get(month) ?? []),
      id,
    ]);
  }
}

class CenariosDemo {
  private readonly loja = inject(LojaDemo);
  async get(): Promise<CenariosDoc | null> {
    return copia(this.loja.cenarios);
  }
  async save(_uid: string, c: CenariosDoc): Promise<void> {
    this.loja.cenarios = copia(c);
  }
}

class ContaDemo {
  private readonly loja = inject(LojaDemo);
  async ultimaImportacao(): Promise<RegistroImportacao | null> {
    const hoje = new Date();
    return {
      id: 'demo-import',
      fileName: 'Open Finance: Conta Corrente',
      added: 3,
      duplicates: 0,
      createdAt: new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
        6,
      ).toISOString(),
    };
  }
  async exportar(): Promise<DadosDoUsuario> {
    const d = this.loja.dados;
    return copia({
      accounts: d.accounts,
      categories: d.categories,
      budgets: d.budgets,
      rules: this.loja.regras,
      imports: [],
      transactions: d.transactions,
      recurrences: [],
      scenarios: [],
      insights: [],
      balances: d.balances,
      connections: d.connections,
      meta: [],
    }) as unknown as DadosDoUsuario;
  }
  async apagarTudo(): Promise<number> {
    const n = this.loja.dados.transactions.length;
    this.loja.dados.transactions = [];
    return n;
  }
}

/**
 * Troca o login e todos os repositórios por versões na memória, com dados fictícios. Usado
 * quando `modoDemoAtivo()`: serve para ver e testar as telas sem acesso ao Firebase.
 */
export function provideModoDemo(): Provider[] {
  return [
    { provide: AuthService, useClass: AuthDemo },
    { provide: TransactionsRepository, useClass: TransacoesDemo },
    { provide: CatalogRepository, useClass: CatalogoDemo },
    { provide: BudgetsRepository, useClass: OrcamentoDemo },
    { provide: RulesRepository, useClass: RegrasDemo },
    { provide: BalancesRepository, useClass: SaldosDemo },
    { provide: ConnectionsRepository, useClass: ConexoesDemo },
    { provide: InsightsRepository, useClass: InsightsDemo },
    { provide: ScenariosRepository, useClass: CenariosDemo },
    { provide: ContaRepository, useClass: ContaDemo },
  ];
}
