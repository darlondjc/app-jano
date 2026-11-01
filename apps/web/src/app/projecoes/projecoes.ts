import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AuthService,
  BalancesRepository,
  CatalogRepository,
  ScenariosRepository,
  TransactionsRepository,
  type CenariosDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import {
  diaNoPeriodo,
  diasNoPeriodo,
  formatBRL,
  previousMonths,
  projetar,
  type Cenario,
} from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import {
  JanoBanner,
  JanoButton,
  JanoSkeletonCard,
  JanoSkeletonGroup,
  JanoSkeletonKpi,
} from '@jano/ui';
import { Preferencias } from '../conta/preferencias';
import { haQuantoTempo } from '../conta/tempo';
import { saldoAtual, type SaldoAtual } from '../inicio/saldo';
import { Progresso } from '../shell/progresso';
import { marcarTransferencias } from '../transacoes/transferencias';
import { mesAtual } from '../transacoes/agrupar';
import { PeriodoService } from '../periodo/periodo.service';
import { planoDoMes } from './plano';
import { PlanoMes } from './plano-mes';
import { ObjetivosCard } from './objetivos-card';

const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const nomeMesLongo = (m: string) => MESES_LONGOS[Number(m.slice(5, 7)) - 1];

const dinheiro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Projeções: plano do mês, objetivos e cenários "e se" sobre o saldo dos próximos meses. */
@Component({
  selector: 'jano-projecoes',
  imports: [
    RouterLink,
    JanoButton,
    JanoBanner,
    JanoSkeletonCard,
    JanoSkeletonGroup,
    JanoSkeletonKpi,
    PlanoMes,
    ObjetivosCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 8px 16px 48px;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
    }
    h2 {
      margin: 0 0 12px;
      font: 600 18px/24px var(--font-sans);
    }
    .topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .chips {
      display: flex;
      gap: 8px;
    }
    .objetivos {
      margin-top: 16px;
    }
    .cenarios {
      margin-top: 24px;
      max-width: 720px;
    }
    .cenarios .chips {
      margin: 4px 0 8px;
    }
    .colunas {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 24px;
      align-items: start;
    }
    .coluna {
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 0;
    }
    .resumo {
      margin: 0 0 8px;
      font: 600 18px/26px var(--font-sans);
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font: 400 13px/20px var(--font-sans);
      color: var(--text-2);
      margin-bottom: 8px;
    }
    .legenda span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legenda i {
      display: inline-block;
      width: 18px;
      height: 0;
      border-top: 2.5px solid;
    }
    .legenda i.faixa {
      height: 10px;
      border: 0;
      background: var(--info);
      opacity: 0.18;
      border-radius: 2px;
    }
    svg {
      display: block;
    }
    svg text {
      font: 400 11px var(--font-sans);
      fill: var(--text-2);
    }
    .saldo {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
      font: 400 14px/20px var(--font-sans);
      color: var(--text-2);
    }
    .saldo .j-input {
      width: 150px;
    }
    .cenario {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .cenario:last-of-type {
      border-bottom: 0;
    }
    .cenario b {
      display: block;
      font: 600 14px/20px var(--font-sans);
    }
    .cenario .desc {
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .eff {
      font: 500 13px/18px var(--font-sans);
    }
    .eff.mais {
      color: var(--positive);
    }
    .eff.menos {
      color: var(--danger);
    }
    .campo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .campo .j-input {
      width: 120px;
    }
    select {
      height: 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: 400 14px/20px var(--font-sans);
      padding: 0 8px;
      margin-top: 6px;
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
    .comparar {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: grid;
      gap: 6px;
      font: 400 14px/20px var(--font-sans);
    }
    .comparar div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .comparar .dif {
      font-weight: 600;
    }
    .data {
      font: 600 14px/20px var(--font-sans);
    }
    .sub {
      font: 400 12px/16px var(--font-sans);
      color: var(--text-2);
    }
    details {
      font: 400 14px/20px var(--font-sans);
      color: var(--text-2);
    }
    summary {
      cursor: pointer;
      color: var(--primary-text);
      font-weight: 500;
    }
    details p {
      margin: 8px 0 0;
    }
    table {
      border-collapse: collapse;
      margin-top: 8px;
      width: 100%;
    }
    th,
    td {
      text-align: right;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border);
    }
    th:first-child,
    td:first-child {
      text-align: left;
    }
    @media (max-width: 1099px) {
      .colunas {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="topo">
      <div>
        <h1>Projeções</h1>
        <div class="j-sub">
          O que vem até o salário e nos próximos meses, a partir de hoje,
          {{ hoje.getDate() }} de {{ mesLongo }}
        </div>
      </div>
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }

    @if (carregando()) {
      <jano-skeleton-group label="Carregando projeções">
        <div class="colunas">
          <div class="coluna">
            <jano-skeleton-card altura="280px" />
            <jano-skeleton-card altura="120px" />
          </div>
          <div class="coluna">
            <jano-skeleton-kpi />
            <jano-skeleton-card altura="160px" />
          </div>
        </div>
      </jano-skeleton-group>
    } @else {
      <jano-plano-mes [plano]="plano()" />
      <jano-objetivos class="objetivos" [base]="baseObjetivos()" />
      @if (!proj()) {
        <div class="j-card j-empty">
          <div class="j-empty__title">Ainda falta histórico para projetar</div>
          <div class="j-empty__text">
            Precisamos de pelo menos 2 meses fechados com lançamentos. Importe
            extratos e faturas dos meses anteriores.
          </div>
          <a janoButton variant="primary" routerLink="/transacoes">Importar</a>
        </div>
      } @else {
        <div class="cenarios">
          <div class="coluna">
            <section class="j-card" aria-label="Cenários">
              <h2>E se…</h2>
              <p class="sub" style="margin: -4px 0 4px">
                Ligue um cenário e veja quanto muda o seu saldo daqui a
                {{ horizonte() }} meses. Fica salvo como você deixar.
              </p>
              <div class="chips" role="group" aria-label="Horizonte">
                @for (h of horizontes; track h) {
                  <button
                    class="j-chip"
                    type="button"
                    [attr.aria-pressed]="horizonte() === h"
                    (click)="horizonte.set(h)"
                  >
                    {{ h }} meses
                  </button>
                }
              </div>

              <div class="cenario">
                <button
                  class="chave"
                  type="button"
                  role="switch"
                  aria-labelledby="c1"
                  [attr.aria-checked]="cortarLigado()"
                  (click)="cortarLigado.set(!cortarLigado())"
                >
                  <span></span>
                </button>
                <div>
                  <b id="c1"
                    >Cortar {{ nomeCategoria(categoriaCorte()) }} em 20%</b
                  >
                  <div class="desc">A partir do mês seguinte</div>
                  <select
                    aria-label="Categoria a cortar"
                    [value]="categoriaCorte()"
                    (change)="categoriaCorte.set($any($event.target).value)"
                  >
                    @for (c of categoriasGasto(); track c.id) {
                      <option
                        [value]="c.id"
                        [selected]="c.id === categoriaCorte()"
                      >
                        {{ c.name }}
                      </option>
                    }
                  </select>
                  @if (cortarLigado()) {
                    <div [class]="classeEfeito(efeito(0))">
                      {{ textoEfeito(efeito(0)) }}
                    </div>
                  }
                </div>
              </div>

              <div class="cenario">
                <button
                  class="chave"
                  type="button"
                  role="switch"
                  aria-labelledby="c2"
                  [attr.aria-checked]="parcelaLigada()"
                  (click)="parcelaLigada.set(!parcelaLigada())"
                >
                  <span></span>
                </button>
                <div>
                  <b id="c2">Nova parcela mensal</b>
                  <div class="desc">Todo mês, a partir do mês seguinte</div>
                  <label class="campo">
                    <span class="j-input">
                      <span class="j-input__prefix">R$</span>
                      <input
                        inputmode="decimal"
                        aria-label="Valor da parcela"
                        [value]="parcelaTexto()"
                        (change)="parcelaTexto.set($any($event.target).value)"
                      />
                    </span>
                  </label>
                  @if (parcelaLigada()) {
                    <div [class]="classeEfeito(efeito(1))">
                      {{ textoEfeito(efeito(1)) }}
                    </div>
                  }
                </div>
              </div>

              <div class="cenario">
                <button
                  class="chave"
                  type="button"
                  role="switch"
                  aria-labelledby="c3"
                  [attr.aria-checked]="rendaLigada()"
                  (click)="rendaLigada.set(!rendaLigada())"
                >
                  <span></span>
                </button>
                <div>
                  <b id="c3">Renda extra</b>
                  <div class="desc">Uma vez, daqui a 2 meses</div>
                  <label class="campo">
                    <span class="j-input">
                      <span class="j-input__prefix">R$</span>
                      <input
                        inputmode="decimal"
                        aria-label="Valor da renda extra"
                        [value]="rendaTexto()"
                        (change)="rendaTexto.set($any($event.target).value)"
                      />
                    </span>
                  </label>
                  @if (rendaLigada() && horizonte() >= 2) {
                    <div [class]="classeEfeito(efeito(2))">
                      {{ textoEfeito(efeito(2)) }}
                    </div>
                  }
                </div>
              </div>

              @if (!saldoBanco()) {
                <div class="saldo">
                  <label for="saldo">Saldo de hoje (opcional):</label>
                  <span class="j-input">
                    <span class="j-input__prefix">R$</span>
                    <input
                      id="saldo"
                      inputmode="decimal"
                      placeholder="0,00"
                      [value]="saldoTexto()"
                      (change)="definirSaldo($any($event.target).value)"
                    />
                  </span>
                  <span class="sub"
                    >Sem ele, o saldo parte de R$ 0 e mostra só a variação.
                    Guardado apenas neste aparelho.</span
                  >
                </div>
              }

              <div class="comparar">
                <div>
                  <span>Saldo base em {{ mesFinal() }}</span>
                  <span class="j-num">{{ money(final().base) }}</span>
                </div>
                <div>
                  <span>Saldo com cenários em {{ mesFinal() }}</span>
                  <span class="j-num">{{ money(final().cenario) }}</span>
                </div>
                <div class="dif">
                  <span>Diferença</span>
                  <span
                    class="j-num"
                    [style.color]="
                      diferenca() > 0
                        ? 'var(--positive)'
                        : diferenca() < 0
                          ? 'var(--danger)'
                          : null
                    "
                    >{{ diferenca() > 0 ? '+' : ''
                    }}{{ money(diferenca()) }}</span
                  >
                </div>
              </div>
            </section>

            <section class="j-card" aria-label="Como calculamos">
              <details>
                <summary>Como calculamos</summary>
                <p>
                  O saldo base parte do seu saldo de hoje e soma, a cada mês, a
                  sobra média dos últimos {{ proj()!.mesesBase }} meses fechados
                  (receitas {{ money(proj()!.receitaMedia) }}, gastos
                  {{ money(proj()!.gastoMedio) }}), dando mais peso aos meses
                  recentes. O resto do mês atual completa a média.
                </p>
                <p>
                  Cenários são ajustes sobre essa base, nunca previsões. Para os
                  próximos 30 dias, o plano do mês acima é mais preciso.
                </p>
              </details>
            </section>
          </div>
        </div>
      }
    }
  `,
})
export class Projecoes {
  private readonly auth = inject(AuthService);
  private readonly periodo = inject(PeriodoService);
  private readonly progresso = inject(Progresso);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly prefs = inject(Preferencias);
  private readonly balancesRepo = inject(BalancesRepository);
  private readonly scenariosRepo = inject(ScenariosRepository);
  /** Só grava cenários depois de restaurar os salvos, para não sobrescrevê-los com o padrão. */
  private restaurado = false;
  /** Último estado gravado (ou restaurado): só grava quando muda de verdade. */
  private ultimoSalvo = '';
  private gravarEm: ReturnType<typeof setTimeout> | undefined;

  protected readonly money = formatBRL;
  protected readonly horizontes = [3, 6, 12];
  protected readonly horizonte = signal(6);

  protected readonly hoje = new Date();
  /** Mês do calendário de hoje (prazos de objetivos, data de hoje). */
  private readonly mesCalendario = mesAtual(this.hoje);
  protected readonly mesLongo = nomeMesLongo(this.mesCalendario);
  /** Período financeiro de hoje; a projeção conta dentro dele. */
  private readonly month = signal(this.mesCalendario);
  private readonly hojeIso = `${this.mesCalendario}-${String(this.hoje.getDate()).padStart(2, '0')}`;

  private readonly historico = signal<TransactionDoc[]>([]);
  private readonly categorias = signal<CategoryDoc[]>([]);
  private readonly cartoes = signal<ReadonlySet<string>>(new Set());
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');

  // Cenários.
  protected readonly cortarLigado = signal(false);
  protected readonly categoriaCorte = signal('lazer');
  protected readonly parcelaLigada = signal(false);
  protected readonly parcelaTexto = signal('400,00');
  protected readonly rendaLigada = signal(false);
  protected readonly rendaTexto = signal('800,00');

  /** Saldo do banco (Open Finance); quando existe, substitui o digitado à mão. */
  protected readonly saldoBanco = signal<SaldoAtual | null>(null);
  /** Fatura em aberto dos cartões (positivo = devido), do banco. */
  private readonly fatura = signal(0);
  /** Saldo da poupança no banco; null sem Open Finance. */
  private readonly poupanca = signal<number | null>(null);
  protected readonly baseObjetivos = computed(() => {
    const p = this.proj();
    return {
      poupancaCents: this.poupanca(),
      sobraMediaCents: p ? p.receitaMedia - p.gastoMedio : null,
      mesAtual: this.mesCalendario,
    };
  });
  protected readonly plano = computed(() =>
    planoDoMes({
      saldoCents: this.saldoBanco()?.cents ?? null,
      faturaCents: this.fatura(),
      txs: this.historico(),
      cartoes: this.cartoes(),
      hoje: this.hojeIso,
    }),
  );
  protected readonly quando = haQuantoTempo;

  protected readonly saldoTexto = computed(() =>
    this.prefs.saldoInicial() ? dinheiro(this.prefs.saldoInicial()) : '',
  );

  protected readonly categoriasGasto = computed(() =>
    this.categorias().filter((c) => c.type === 'despesa'),
  );

  private readonly cenarios = computed<{ lista: Cenario[]; origem: number[] }>(
    () => {
      const lista: Cenario[] = [];
      const origem: number[] = [];
      if (this.cortarLigado()) {
        lista.push({
          tipo: 'cortar',
          categoryId: this.categoriaCorte(),
          pct: 20,
        });
        origem.push(0);
      }
      const parcela = parseAmountToCents(this.parcelaTexto());
      if (this.parcelaLigada() && parcela && parcela > 0) {
        lista.push({ tipo: 'parcela', cents: parcela });
        origem.push(1);
      }
      const renda = parseAmountToCents(this.rendaTexto());
      if (this.rendaLigada() && renda && renda > 0) {
        lista.push({ tipo: 'renda', cents: renda, mesesAFrente: 2 });
        origem.push(2);
      }
      return { lista, origem };
    },
  );
  protected readonly proj = computed(() =>
    projetar({
      txs: this.historico(),
      cartoes: this.cartoes(),
      month: this.month(),
      dia: diaNoPeriodo(this.hojeIso),
      diasNoMes: diasNoPeriodo(this.month()),
      horizonte: this.horizonte(),
      saldoInicial: this.saldoBanco()?.cents ?? this.prefs.saldoInicial(),
      cenarios: this.cenarios().lista,
    }),
  );

  protected readonly final = computed(
    () => this.proj()!.pontos[this.proj()!.pontos.length - 1],
  );
  protected readonly diferenca = computed(
    () => this.final().cenario - this.final().base,
  );
  protected readonly mesFinal = computed(() => nomeMesLongo(this.final().mes));
  constructor() {
    void this.carregar();
  }

  protected nomeCategoria(id: string | null): string {
    return id
      ? (this.categorias().find((c) => c.id === id)?.name ?? id)
      : 'Sem categoria';
  }

  protected definirSaldo(texto: string): void {
    this.prefs.definirSaldoInicial(
      texto.trim() ? (parseAmountToCents(texto) ?? 0) : 0,
    );
  }

  /** Efeito acumulado de um cenário (0 corte, 1 parcela, 2 renda) até o fim do horizonte. */
  protected efeito(origem: number): number {
    const i = this.cenarios().origem.indexOf(origem);
    return i < 0 ? 0 : (this.proj()?.efeitos[i] ?? 0);
  }

  protected classeEfeito(v: number): string {
    return `eff ${v >= 0 ? 'mais' : 'menos'}`;
  }

  protected textoEfeito(v: number): string {
    return `${v >= 0 ? '+' : ''}${formatBRL(v)} até ${this.mesFinal()}`;
  }

  private carregar(): Promise<void> {
    return this.progresso.acompanhar(this.carregarDados());
  }

  private async carregarDados(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    try {
      await this.periodo.garantir();
      this.month.set(this.periodo.atual());
      const [txs, cats, contas, saldos, salvos] = await Promise.all([
        this.txRepo.listRange(
          uid,
          previousMonths(this.month(), 7).at(-1) as string,
          this.mesCalendario,
        ),
        this.catalog.categories(uid),
        this.catalog.accounts(uid),
        this.balancesRepo.list(uid).catch(() => []),
        this.scenariosRepo.get(uid).catch(() => null),
      ]);
      this.saldoBanco.set(saldoAtual(saldos));
      const poupancas = saldos.filter(
        (b) => b.kind === 'conta' && b.detail === 'poupança',
      );
      this.poupanca.set(
        poupancas.length
          ? poupancas.reduce((s, b) => s + b.balanceCents, 0)
          : null,
      );
      this.fatura.set(
        saldos
          .filter((b) => b.kind === 'cartao')
          .reduce((soma, b) => soma + Math.max(0, b.balanceCents), 0),
      );
      this.cartoes.set(
        new Set(contas.filter((c) => c.type === 'cartao').map((c) => c.id)),
      );
      this.historico.set(
        (await marcarTransferencias(this.txRepo, uid, txs)).txs,
      );
      this.categorias.set(cats);
      const despesas = cats.filter((c) => c.type === 'despesa');
      if (!despesas.some((c) => c.id === 'lazer') && despesas[0])
        this.categoriaCorte.set(despesas[0].id);
      if (salvos) this.restaurar(salvos, despesas);
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Tente de novo em instantes.',
      );
    } finally {
      this.carregando.set(false);
      this.restaurado = true;
      this.ultimoSalvo = JSON.stringify(this.cenariosAtuais());
    }
  }

  private restaurar(c: CenariosDoc, despesas: CategoryDoc[]): void {
    this.cortarLigado.set(c.cortarLigado);
    // Categoria apagada desde então: fica a padrão.
    if (despesas.some((d) => d.id === c.categoriaCorte))
      this.categoriaCorte.set(c.categoriaCorte);
    this.parcelaLigada.set(c.parcelaLigada);
    this.parcelaTexto.set(c.parcelaTexto);
    this.rendaLigada.set(c.rendaLigada);
    this.rendaTexto.set(c.rendaTexto);
    if ([3, 6, 12].includes(c.horizonte)) this.horizonte.set(c.horizonte);
  }

  private readonly cenariosAtuais = computed<CenariosDoc>(() => ({
    cortarLigado: this.cortarLigado(),
    categoriaCorte: this.categoriaCorte(),
    parcelaLigada: this.parcelaLigada(),
    parcelaTexto: this.parcelaTexto(),
    rendaLigada: this.rendaLigada(),
    rendaTexto: this.rendaTexto(),
    horizonte: this.horizonte(),
  }));

  /** Grava os cenários um instante depois da última mudança. Falhar (sem rede) não atrapalha. */
  private readonly salvarCenarios = effect(() => {
    const c = this.cenariosAtuais();
    const uid = this.auth.user()?.uid;
    const json = JSON.stringify(c);
    if (!this.restaurado || !uid || json === this.ultimoSalvo) return;
    this.ultimoSalvo = json;
    clearTimeout(this.gravarEm);
    this.gravarEm = setTimeout(
      () => void this.scenariosRepo.save(uid, c).catch(() => undefined),
      800,
    );
  });
}
