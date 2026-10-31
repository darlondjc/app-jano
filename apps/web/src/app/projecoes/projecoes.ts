import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
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
  detectRecurrences,
  formatBRL,
  previousMonths,
  projetar,
  proximaCobranca,
  valoresOcultos,
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
import { planoDoMes } from './plano';
import { PlanoMes } from './plano-mes';

const MESES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
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
const nomeMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1];
const nomeMesLongo = (m: string) => MESES_LONGOS[Number(m.slice(5, 7)) - 1];

function rotuloSaldo(cents: number): string {
  if (valoresOcultos()) return 'R$ ••';
  const reais = cents / 100;
  const sinal = reais < 0 ? '−' : '';
  const abs = Math.abs(reais);
  return abs >= 1000
    ? `${sinal}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : `${sinal}R$ ${Math.round(abs)}`;
}

const dinheiro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Projeções: saldo previsto, faixa de incerteza e cenários "e se". */
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
    .longo {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin: 32px 0 16px;
    }
    .longo h2 {
      margin: 0;
      font: 600 20px/28px var(--font-sans);
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
      <div class="longo">
        <h2>Longo prazo</h2>
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
      </div>
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
        <div class="colunas">
          <div class="coluna">
            <section class="j-card" aria-label="Saldo projetado">
              <h2>Saldo projetado</h2>
              <p class="resumo">{{ frase() }}</p>
              <div class="legenda">
                <span><i style="border-color: var(--text)"></i>Realizado</span>
                <span
                  ><i
                    style="border-color: var(--info); border-top-style: dashed"
                  ></i
                  >Projeção base</span
                >
                <span><i class="faixa"></i>Faixa otimista e pessimista</span>
                @if (cenariosAtivos().length) {
                  <span
                    ><i style="border-color: var(--primary)"></i>Com
                    cenários</span
                  >
                }
              </div>
              <svg
                [attr.width]="w()"
                [attr.height]="altura"
                role="img"
                [attr.aria-label]="frase()"
              >
                @for (t of yTicks(); track t.y) {
                  <line
                    [attr.x1]="x0"
                    [attr.x2]="w() - 8"
                    [attr.y1]="t.y"
                    [attr.y2]="t.y"
                    style="stroke: var(--border)"
                  />
                  <text [attr.x]="x0 - 6" [attr.y]="t.y + 4" text-anchor="end">
                    {{ t.rotulo }}
                  </text>
                }
                <polygon
                  [attr.points]="faixa()"
                  style="fill: var(--info); opacity: 0.16"
                />
                <polyline
                  [attr.points]="linhaRealizado()"
                  fill="none"
                  style="stroke: var(--text)"
                  stroke-width="2.5"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <polyline
                  [attr.points]="linhaBase()"
                  fill="none"
                  style="stroke: var(--info)"
                  stroke-width="2.5"
                  stroke-dasharray="6 5"
                  stroke-linecap="round"
                />
                @if (cenariosAtivos().length) {
                  <polyline
                    [attr.points]="linhaCenario()"
                    fill="none"
                    style="stroke: var(--primary)"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                }
                <line
                  [attr.x1]="hojeXY().x"
                  [attr.x2]="hojeXY().x"
                  [attr.y1]="topo"
                  [attr.y2]="base"
                  style="stroke: var(--border-strong)"
                  stroke-dasharray="2 3"
                />
                <circle
                  [attr.cx]="hojeXY().x"
                  [attr.cy]="hojeXY().y"
                  r="5"
                  style="fill: var(--text)"
                />
                <text [attr.x]="hojeXY().x + 6" [attr.y]="topo + 10">hoje</text>
                @for (m of xTicks(); track m.x) {
                  <text
                    [attr.x]="m.x"
                    [attr.y]="base + 20"
                    text-anchor="middle"
                  >
                    {{ m.t }}
                  </text>
                }
              </svg>

              @if (saldoBanco(); as s) {
                <div class="saldo">
                  <span
                    >Saldo de hoje:
                    <b class="j-num">{{ money(s.cents) }}</b></span
                  >
                  <span class="sub"
                    >{{ s.legenda }}, do banco, atualizado
                    {{ quando(s.atualizadoEm) }}.</span
                  >
                </div>
              } @else {
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
                    >Sem ele, o gráfico parte de R$ 0 e mostra só a variação.
                    Guardado apenas neste aparelho.</span
                  >
                </div>
              }

              <details style="margin-top: 12px">
                <summary>Ver os valores do gráfico</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Fim de</th>
                      <th scope="col">Base</th>
                      <th scope="col">Com cenários</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of proj()!.pontos; track p.k) {
                      <tr>
                        <td>{{ rotuloMes(p.mes) }}</td>
                        <td>{{ money(p.base) }}</td>
                        <td>{{ money(p.cenario) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </details>
            </section>
          </div>

          <div class="coluna">
            <section class="j-card" aria-label="Cenários">
              <h2>E se…</h2>
              <p class="sub" style="margin: -4px 0 4px">
                Ligue um cenário e veja o efeito no gráfico. Fica salvo como
                você deixar.
              </p>

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
                  A projeção parte do seu saldo de hoje e soma, a cada mês, a
                  sobra média dos últimos {{ proj()!.mesesBase }} meses fechados
                  (receitas {{ money(proj()!.receitaMedia) }}, gastos
                  {{ money(proj()!.gastoMedio) }}), dando mais peso aos meses
                  recentes. O resto do mês atual completa a média.
                </p>
                <p>
                  A faixa mostra uma variação possível para mais e para menos,
                  calculada pela oscilação das sobras passadas, e cresce com o
                  tempo. Cenários são ajustes sobre essa base, nunca previsões.
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
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly money = formatBRL;
  protected readonly horizontes = [3, 6, 12];
  protected readonly horizonte = signal(6);
  protected readonly x0 = 74;
  protected readonly topo = 16;
  protected readonly w = signal(640);
  protected readonly altura = 300;
  protected readonly base = this.altura - 36;

  protected readonly hoje = new Date();
  private readonly month = mesAtual(this.hoje);
  protected readonly mesLongo = nomeMesLongo(this.month);

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
  protected readonly plano = computed(() =>
    planoDoMes({
      saldoCents: this.saldoBanco()?.cents ?? null,
      faturaCents: this.fatura(),
      txs: this.historico(),
      cartoes: this.cartoes(),
      hoje: `${this.month}-${String(this.hoje.getDate()).padStart(2, '0')}`,
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
  protected readonly cenariosAtivos = computed(() => this.cenarios().lista);

  protected readonly proj = computed(() =>
    projetar({
      txs: this.historico(),
      cartoes: this.cartoes(),
      month: this.month,
      dia: this.hoje.getDate(),
      diasNoMes: new Date(
        this.hoje.getFullYear(),
        this.hoje.getMonth() + 1,
        0,
      ).getDate(),
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
  protected readonly frase = computed(() => {
    const f = this.final();
    return `Em ${this.mesFinal()} o saldo base é de ${formatBRL(f.base)}, com faixa de ${formatBRL(f.pessimista)} a ${formatBRL(f.otimista)}.`;
  });

  // Gráfico: eixo x em meses; x = 0, 1, 2 são os fins dos 3 meses anteriores, "hoje" fica entre 2 e 3 e o fim do mês atual é 3.
  private readonly colunas = computed(() => 4 + this.horizonte());
  private px(i: number): number {
    return this.x0 + (i / (this.colunas() - 1)) * (this.w() - this.x0 - 12);
  }
  private readonly escala = computed(() => {
    const p = this.proj()!;
    const valores = [
      ...p.realizado.map((r) => r.valor),
      p.hoje,
      ...p.pontos.flatMap((q) => [q.base, q.cenario, q.otimista, q.pessimista]),
    ];
    const mn = Math.min(...valores);
    const mx = Math.max(...valores);
    const folga = Math.max((mx - mn) * 0.08, 1000);
    return { a0: mn - folga, a1: mx + folga };
  });
  private py(v: number): number {
    const { a0, a1 } = this.escala();
    return this.base - ((v - a0) / (a1 - a0)) * (this.base - this.topo);
  }
  private pt(x: number, v: number): string {
    return `${this.px(x).toFixed(1)},${this.py(v).toFixed(1)}`;
  }
  private readonly xHoje = computed(() => 2 + this.proj()!.fracaoMes);

  protected readonly hojeXY = computed(() => ({
    x: this.px(this.xHoje()),
    y: this.py(this.proj()!.hoje),
  }));
  protected readonly linhaRealizado = computed(() => {
    const p = this.proj()!;
    return [
      ...p.realizado.map((r, i) => this.pt(i, r.valor)),
      this.pt(this.xHoje(), p.hoje),
    ].join(' ');
  });
  protected readonly linhaBase = computed(() => {
    const p = this.proj()!;
    return [
      this.pt(this.xHoje(), p.hoje),
      ...p.pontos.map((q) => this.pt(3 + q.k, q.base)),
    ].join(' ');
  });
  protected readonly linhaCenario = computed(() => {
    const p = this.proj()!;
    return [
      this.pt(this.xHoje(), p.hoje),
      ...p.pontos.map((q) => this.pt(3 + q.k, q.cenario)),
    ].join(' ');
  });
  protected readonly faixa = computed(() => {
    const p = this.proj()!;
    const ini = this.pt(this.xHoje(), p.hoje);
    return [
      ini,
      ...p.pontos.map((q) => this.pt(3 + q.k, q.otimista)),
      ...[...p.pontos].reverse().map((q) => this.pt(3 + q.k, q.pessimista)),
    ].join(' ');
  });
  protected readonly yTicks = computed(() => {
    const { a0, a1 } = this.escala();
    return [0, 1, 2, 3].map((q) => {
      const v = a0 + ((a1 - a0) * q) / 3;
      return { y: this.py(v), rotulo: rotuloSaldo(v) };
    });
  });
  protected readonly xTicks = computed(() => {
    const p = this.proj()!;
    const meses = [
      ...p.realizado.map((r, i) => ({ mes: r.mes, i })),
      ...p.pontos.map((q) => ({ mes: q.mes, i: 3 + q.k })),
    ];
    const passo = meses.length > 10 ? 2 : 1;
    return meses
      .map((m) => ({ t: nomeMes(m.mes), x: this.px(m.i) }))
      .filter((_, i) => i % passo === 0);
  });

  constructor() {
    void this.carregar();
    afterNextRender(() => {
      const medir = () =>
        this.w.set(
          Math.max(
            Math.round(
              this.el.nativeElement
                .querySelector('section[aria-label="Saldo projetado"]')
                ?.getBoundingClientRect().width ?? 640,
            ) - 40,
            280,
          ),
        );
      medir();
      if (typeof ResizeObserver !== 'undefined')
        new ResizeObserver(medir).observe(this.el.nativeElement);
    });
  }

  protected rotuloMes(m: string): string {
    return `${nomeMesLongo(m)} ${m.slice(0, 4)}`;
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
      const [txs, cats, contas, saldos, salvos] = await Promise.all([
        this.txRepo.listRange(
          uid,
          previousMonths(this.month, 6).at(-1) as string,
          this.month,
        ),
        this.catalog.categories(uid),
        this.catalog.accounts(uid),
        this.balancesRepo.list(uid).catch(() => []),
        this.scenariosRepo.get(uid).catch(() => null),
      ]);
      this.saldoBanco.set(saldoAtual(saldos));
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
