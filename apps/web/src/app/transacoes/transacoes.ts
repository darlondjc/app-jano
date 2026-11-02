import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  Injector,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { categorizar } from '@jano/open-finance';
import {
  AuthService,
  CatalogRepository,
  RulesRepository,
  TransactionsRepository,
  type RuleDoc,
  slugify,
  type AccountDoc,
  type CategoryDoc,
  type TransactionDoc,
} from '@jano/data-access';
import { calendario, formatBRL, mesesDoPeriodo, monthOf } from '@jano/engine';
import { Toast } from '../toast/toast';
import { PeriodoService } from '../periodo/periodo.service';
import { ApelidosService } from '../apelidos/apelidos.service';
import {
  DEFAULT_RULES,
  addDedupeKeys,
  bankCategoryToName,
  decodeBytes,
  isFaturaBB,
  isLikelyTransfer,
  parseFaturaBB,
  parseOfx,
  planImport,
  suggestCategory,
  type FaturaResult,
  type ImportPlan,
  regraQueCasa,
  nomeDeExibicao,
  tipoDeOperacao,
} from '@jano/import-file';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoMonthNav,
  JanoSkeleton,
  JanoSkeletonGroup,
  JanoSkeletonRows,
  JanoPageHead,
} from '@jano/ui';
import {
  agruparPorDia,
  classeValor,
  dataCurta,
  mesAnterior,
  mesAtual,
  mesSeguinte,
  rotuloMes,
  rotuloTransferencia,
} from './agrupar';
import {
  DetalheTransacao,
  TRANSFERENCIA,
  avisoDoSalvar,
  type SalvarDetalhe,
} from './detalhe';
import {
  filtrar,
  SEM_FILTROS,
  totalDeFiltros,
  totalizar,
  type Filtros,
  type TipoFiltro,
} from './filtrar';
import { linhasDoPdf } from './pdf';
import { marcarTransferencias } from './transferencias';
import { Progresso } from '../shell/progresso';

interface Previa {
  fileName: string;
  accountId: string;
  plan: ImportPlan;
  erros: { index: number; reason: string }[];
  semSugestao: number;
  fatura?: FaturaResult;
}

@Component({
  selector: 'jano-transacoes',
  imports: [
    JanoPageHead,
    JanoButton,
    JanoBanner,
    JanoCategoryBadge,
    JanoMonthNav,
    JanoSkeleton,
    JanoSkeletonGroup,
    JanoSkeletonRows,
    DetalheTransacao,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    jano-page-head label.imp {
      flex: none;
    }
    input[type='file'] {
      display: none;
    }
    .barra {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .busca {
      height: 44px;
      max-width: 520px;
    }
    .busca svg {
      margin-right: 8px;
      color: var(--text-2);
      flex: none;
    }
    /* Quebra de linha em vez de rolar: nenhum filtro fica escondido no celular. */
    .linha-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .linha-chips .j-chip {
      flex: none;
    }
    .selecionar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-left: auto;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      cursor: pointer;
    }
    .selecionar[aria-pressed='true'] {
      background: var(--primary-soft);
      border-color: var(--primary);
      color: var(--primary-text);
    }
    .selecionar:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .selecionar svg,
    .linha-chips svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .j-chip.pendente:not([aria-pressed='true']) {
      border-color: var(--warning);
      color: var(--warning-text);
    }
    .j-chip.ativo {
      background: var(--primary-soft);
      border-color: var(--primary);
      color: var(--primary-text);
    }
    @media (max-width: 599px) {
      jano-month-nav {
        max-width: none;
      }
    }
    .ocultar-largo {
      display: inline-flex;
    }
    .corpo {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
      margin-top: 16px;
      align-items: start;
    }
    .escurece {
      border: 0;
      padding: 0;
      cursor: default;
      position: fixed;
      inset: 0;
      background: var(--overlay);
      z-index: 55;
    }
    .filtros {
      display: none;
      flex-direction: column;
      gap: 20px;
      --j-sheet-px: 16px;
    }
    .filtros h2,
    .filtros-titulo {
      margin: 0;
      font: 600 18px/24px var(--font-sans);
    }
    .filtros.aberto,
    .detalhe {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 60;
      max-height: 85vh;
      /* dvh: no iPhone, 85vh passa da área visível e esconde o pé do painel. */
      max-height: 85dvh;
      overflow: auto;
      overscroll-behavior: contain;
      background: var(--surface);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      box-shadow: var(--shadow-sheet);
      /* Sem respiro embaixo: o Salvar fica preso ao pé do painel. */
      padding: 20px 16px 0;
      box-sizing: border-box;
    }
    .filtros.aberto {
      display: flex;
    }
    .detalhe {
      display: block;
    }
    .grupo-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cats {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .cats label {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 32px;
      font: 400 14px/20px var(--font-sans);
    }
    .cats input {
      accent-color: var(--primary);
    }
    .ponto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex: none;
    }
    /* Total do que a lista mostra: muda com a busca e os filtros. */
    .totais {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 12px;
      padding: 12px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .totais .somas {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .totais .somas > span {
      display: flex;
      flex-direction: column;
    }
    .totais b {
      font: 600 18px/24px var(--font-sans);
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .totais b.positivo {
      color: var(--positive);
    }
    .tabela-wrap {
      display: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: auto;
      background: var(--surface);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 560px;
    }
    th {
      font: 600 12px/16px var(--font-sans);
      letter-spacing: 0.06em;
      color: var(--text-2);
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
      white-space: nowrap;
    }
    td {
      font: 400 14px/20px var(--font-sans);
      padding: 0 12px;
      height: 44px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    tr.sel td {
      background: var(--primary-soft);
    }
    td.num,
    th.num {
      text-align: right;
    }
    .desc {
      all: unset;
      cursor: pointer;
      font-weight: 500;
      max-width: 340px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .desc:focus-visible,
    .linha-m:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    td.suave {
      color: var(--text-2);
    }
    .chk {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }
    .lista-m {
      display: block;
    }
    .linha-m {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      cursor: pointer;
    }
    .linha-m.j-tx {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 12px;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    /* Chegou por um insight: pisca duas vezes e some. */
    .destaque {
      animation: destacar 2.4s ease-out;
    }
    @keyframes destacar {
      0%,
      20%,
      45% {
        background: var(--primary-soft);
        box-shadow: inset 4px 0 0 var(--primary);
      }
      32% {
        background: var(--surface);
      }
      100% {
        background: var(--surface);
        box-shadow: inset 4px 0 0 transparent;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .destaque {
        animation: none;
        background: var(--primary-soft);
      }
    }
    .linha-m.sel {
      background: var(--primary-soft);
    }
    .lista-m .blocao {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      overflow: clip;
    }
    .dia-cab {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px 6px;
      background: var(--surface-2);
      font: 600 12px/16px var(--font-sans);
      letter-spacing: 0.02em;
      color: var(--text-2);
    }
    .linha-m.j-tx:last-child,
    .linha-m.j-tx:has(+ .dia-cab) {
      border-bottom: 0;
    }
    .mais {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }
    .acao-lote {
      position: sticky;
      bottom: 80px;
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px 16px;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-popover);
      z-index: 20;
    }
    .acao-lote select {
      height: 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: 400 14px/20px var(--font-sans);
      padding: 0 8px;
    }
    select {
      height: 36px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: 400 14px/20px var(--font-sans);
      padding: 0 8px;
      width: 100%;
    }
    .previa {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .previa dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 16px;
      margin: 0;
    }
    .previa dd {
      margin: 0;
      text-align: right;
    }
    @media (min-width: 720px) {
      .tabela-wrap {
        display: block;
      }
      .lista-m {
        display: none;
      }
      .acao-lote {
        bottom: 16px;
      }
    }
    @media (min-width: 1100px) {
      .com-detalhe {
        grid-template-columns: minmax(0, 1fr) 360px;
      }
      .detalhe {
        position: sticky;
        top: 16px;
        left: auto;
        right: auto;
        bottom: auto;
        z-index: auto;
        max-height: calc(100vh - 32px);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: none;
      }
      .escurece.so-estreito {
        display: none;
      }
    }
    @media (min-width: 1360px) {
      .corpo {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      .corpo.com-detalhe {
        grid-template-columns: 240px minmax(0, 1fr) 360px;
      }
      .filtros {
        display: flex;
        position: static;
        max-height: none;
        padding: 0 8px 0 0;
        box-shadow: none;
        background: transparent;
        border-radius: 0;
      }
      .ocultar-largo,
      .fechar-filtros {
        display: none;
      }
      /* Na coluna lateral a lista rola sozinha e o rodapé não precisa ficar preso. */
      .cats {
        max-height: 300px;
        overflow: auto;
      }
      .filtros .j-sheet__acoes {
        position: static;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
      }
    }
    @media (max-width: 899px) {
      .acao-lote {
        bottom: 88px;
      }
    }
  `,
  template: `
    <jano-page-head titulo="Transações">
      <button
        class="selecionar"
        type="button"
        [attr.aria-pressed]="selecionando()"
        [attr.aria-label]="
          selecionando() ? 'Parar de selecionar' : 'Selecionar transações'
        "
        [title]="selecionando() ? 'Parar de selecionar' : 'Selecionar'"
        (click)="alternarSelecao()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      </button>
      <label class="imp">
        <input
          type="file"
          accept=".ofx,.OFX,.pdf,.PDF"
          (change)="escolherArquivo($event)"
        />
        <span
          class="j-btn j-btn--primary"
          role="button"
          tabindex="0"
          title="Importar extrato (OFX) ou fatura do cartão (PDF)"
          aria-label="Importar extrato ou fatura"
          >Importar</span
        >
      </label>
    </jano-page-head>

    <div class="barra">
      <label class="j-input busca">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="11"
            cy="11"
            r="7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M16.5 16.5L21 21"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nome, valor ou categoria"
          aria-label="Buscar transações"
          [value]="filtros().busca"
          (input)="mudar({ busca: $any($event.target).value })"
        />
      </label>
      <div class="linha-chips" role="group" aria-label="Filtros rápidos">
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="filtros().tipo === 'gastos'"
          (click)="alternarTipo('gastos')"
        >
          Gastos
        </button>
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="filtros().tipo === 'receitas'"
          (click)="alternarTipo('receitas')"
        >
          Receitas
        </button>
        @if (semCategoriaN() || filtros().semCategoria) {
          <button
            class="j-chip pendente"
            type="button"
            [attr.aria-pressed]="filtros().semCategoria"
            (click)="mudar({ semCategoria: !filtros().semCategoria })"
          >
            Sem categoria · {{ semCategoriaN() }}
          </button>
        }
        <button
          class="j-chip ocultar-largo"
          type="button"
          (click)="filtrosAbertos.set(true)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
        </button>
        @for (a of filtrosAtivos(); track a.chave) {
          <button
            class="j-chip ativo"
            type="button"
            [attr.aria-label]="'Remover filtro ' + a.rotulo"
            (click)="removerFiltro(a.chave)"
          >
            {{ a.rotulo }}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        }
      </div>
      <jano-month-nav
        aria-label="Período"
        [rotulo]="rotulo()"
        [navegavel]="periodo().tipo === 'mes'"
        [opcoes]="opcoesPeriodo()"
        (anterior)="mudarMes(-1)"
        (proximo)="mudarMes(1)"
        (opcao)="escolherPeriodo($event)"
      />
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }
    @if (aviso()) {
      <jano-banner tone="info">{{ aviso() }}</jano-banner>
    }

    @if (previa(); as p) {
      <section class="j-card previa" aria-label="Prévia da importação">
        <h2 style="margin:0;font:600 18px/24px var(--font-sans)">
          Revisar importação
        </h2>
        <div class="j-sub">{{ p.fileName }}</div>
        <label class="j-field">
          <span class="j-field__label">Importar para</span>
          <select
            [value]="p.accountId"
            (change)="trocarConta($event)"
            aria-label="Conta de destino"
          >
            @for (a of contas(); track a.id) {
              <option [value]="a.id" [selected]="a.id === p.accountId">
                {{ a.nickname }}
              </option>
            }
          </select>
        </label>
        @if (p.fatura; as f) {
          <div class="j-sub">
            Fatura fechada em {{ dataBr(f.meta.closingDate) }} · vence em
            {{ dataBr(f.meta.dueDate) }} · total
            {{ f.meta.totalCents !== null ? money(f.meta.totalCents) : '—' }}
          </div>
          @for (w of f.warnings; track w) {
            <jano-banner tone="warn">{{ w }}</jano-banner>
          }
          @if (!f.warnings.length) {
            <jano-banner tone="good"
              >As somas batem com os subtotais da fatura.</jano-banner
            >
          }
        }
        <dl>
          <dt>Novas</dt>
          <dd class="j-num">
            <b>{{ p.plan.fresh.length }}</b>
          </dd>
          <dt>Já importadas antes</dt>
          <dd class="j-num">{{ p.plan.duplicates.length }}</dd>
          <dt>Sem categoria sugerida</dt>
          <dd class="j-num">{{ p.semSugestao }}</dd>
          <dt>Linhas com problema</dt>
          <dd class="j-num">{{ p.erros.length }}</dd>
        </dl>
        @if (p.erros.length) {
          <jano-banner tone="warn">
            {{ p.erros.length }} linhas ficaram de fora: {{ p.erros[0].reason }}
          </jano-banner>
        }
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button
            janoButton
            variant="secondary"
            type="button"
            (click)="cancelar()"
          >
            Cancelar
          </button>
          <button
            janoButton
            variant="primary"
            type="button"
            [disabled]="!p.plan.fresh.length"
            [carregando]="ocupado()"
            textoCarregando="Importando…"
            (click)="confirmar()"
          >
            {{ 'Importar ' + p.plan.fresh.length + ' transações' }}
          </button>
        </div>
      </section>
    }

    <div class="corpo" [class.com-detalhe]="!!detalhe()">
      @if (filtrosAbertos()) {
        <button
          type="button"
          class="escurece"
          aria-label="Fechar"
          (click)="filtrosAbertos.set(false)"
        ></button>
      }
      <section
        class="filtros"
        [class.aberto]="filtrosAbertos()"
        aria-label="Filtros"
      >
        <h2>Filtros</h2>
        <div>
          <div class="j-field__label" style="margin-bottom: 8px">Tipo</div>
          <div class="grupo-chips">
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="filtros().tipo === 'gastos'"
              (click)="alternarTipo('gastos')"
            >
              Gastos
            </button>
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="filtros().tipo === 'receitas'"
              (click)="alternarTipo('receitas')"
            >
              Receitas
            </button>
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="filtros().tipo === 'transferencias'"
              (click)="alternarTipo('transferencias')"
            >
              Transferências
            </button>
          </div>
        </div>
        <div>
          <div class="j-field__label" style="margin-bottom: 8px">Conta</div>
          <div class="grupo-chips">
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="!filtros().conta"
              (click)="mudar({ conta: null })"
            >
              Todas
            </button>
            @for (a of contas(); track a.id) {
              <button
                class="j-chip"
                type="button"
                [attr.aria-pressed]="filtros().conta === a.id"
                (click)="mudar({ conta: a.id })"
              >
                {{ a.nickname }}
              </button>
            }
          </div>
        </div>
        <div>
          <div class="j-field__label" style="margin-bottom: 8px">
            Categorias
          </div>
          <div class="cats">
            <label>
              <input
                type="checkbox"
                [checked]="filtros().categorias.includes('')"
                (change)="alternarCategoria('')"
              />
              <i class="ponto" style="background: var(--border-strong)"></i>Sem
              categoria
            </label>
            @for (c of categoriasOrdenadas(); track c.id) {
              <label>
                <input
                  type="checkbox"
                  [checked]="filtros().categorias.includes(c.id)"
                  (change)="alternarCategoria(c.id)"
                />
                <i
                  class="ponto"
                  [style.background]="'var(--' + c.color + ')'"
                ></i
                >{{ c.name }}
              </label>
            }
          </div>
        </div>
        <div class="j-sheet__acoes">
          <button janoButton variant="ghost" type="button" (click)="limpar()">
            Limpar filtros
          </button>
          <button
            janoButton
            variant="primary"
            class="fechar-filtros"
            type="button"
            style="margin-left: auto"
            (click)="filtrosAbertos.set(false)"
          >
            Ver resultados
          </button>
        </div>
      </section>

      <main>
        @if (carregando()) {
          <jano-skeleton-group label="Carregando transações">
            <jano-skeleton-rows [count]="8" />
          </jano-skeleton-group>
        } @else if (!txs().length) {
          <div class="j-empty" style="padding: 48px 16px">
            @if (mesAtualVazio()) {
              <div class="j-empty__title">
                {{
                  porSalario()
                    ? 'Nada neste período ainda'
                    : 'Nada em ' +
                      rotulo().split(' ')[0].toLowerCase() +
                      ' ainda'
                }}
              </div>
              <div class="j-empty__text">
                A sincronização diária traz os lançamentos novos assim que o
                banco registrar.
              </div>
              <button
                janoButton
                variant="secondary"
                type="button"
                (click)="mudarMes(-1)"
              >
                Ver {{ mesAnteriorRotulo() }}
              </button>
            } @else {
              <div class="j-empty__title">Nenhuma transação neste período</div>
              <div class="j-empty__text">
                Importe o extrato (OFX) da conta ou a fatura do cartão (PDF) do
                Banco do Brasil, ou escolha outro mês.
              </div>
            }
          </div>
        } @else if (!filtradas().length) {
          <div class="j-empty" style="padding: 48px 16px">
            <div class="j-empty__title">Nada encontrado</div>
            <div class="j-empty__text">
              Confira a grafia ou busque só por parte do nome. A busca olha
              {{ rotulo() }}.
            </div>
            <button
              janoButton
              variant="secondary"
              type="button"
              (click)="limpar()"
            >
              Limpar busca e filtros
            </button>
          </div>
        } @else {
          @let tot = totais();
          <div class="totais" aria-live="polite">
            <span class="somas">
              @if (filtros().tipo === 'transferencias') {
                <span
                  >Transferido <b>{{ money(tot.transferidoCents) }}</b></span
                >
              } @else {
                @if (tot.gastosCents || !tot.entradasCents) {
                  <span
                    >Gastos <b>{{ money(tot.gastosCents) }}</b></span
                  >
                }
                @if (tot.entradasCents) {
                  <span
                    >Entradas
                    <b class="positivo"
                      >+{{ money(tot.entradasCents) }}</b
                    ></span
                  >
                }
              }
            </span>
            <span class="j-cap"
              >{{ tot.n }} {{ tot.n === 1 ? 'transação' : 'transações' }}</span
            >
          </div>
          <div class="tabela-wrap">
            <table>
              <thead>
                <tr>
                  @if (selecionando()) {
                    <th scope="col"><span class="j-cap">Sel.</span></th>
                  }
                  <th scope="col">DATA ↓</th>
                  <th scope="col">DESCRIÇÃO</th>
                  <th scope="col">CATEGORIA</th>
                  <th scope="col">CONTA</th>
                  <th scope="col" class="num">VALOR</th>
                </tr>
              </thead>
              <tbody>
                @for (t of visiveis(); track t.id) {
                  <tr
                    [attr.data-tx]="t.id"
                    [class.destaque]="destaque() === t.id"
                    [class.sel]="
                      selecionadas().has(t.id) || detalhe()?.id === t.id
                    "
                  >
                    @if (selecionando()) {
                      <td>
                        <input
                          class="chk"
                          type="checkbox"
                          [checked]="selecionadas().has(t.id)"
                          (change)="marcar(t.id)"
                          [attr.aria-label]="
                            'Selecionar ' + nomeTx(t.description)
                          "
                        />
                      </td>
                    }
                    <td class="num suave j-num" style="text-align: left">
                      {{ dataCurta(t.date) }}
                    </td>
                    <td>
                      <button
                        type="button"
                        class="desc"
                        [title]="t.description"
                        (click)="abrir(t)"
                      >
                        {{ nomeTx(t.description) }}
                      </button>
                    </td>
                    <td>
                      <span class="j-tag">
                        <i
                          class="j-tag__dot"
                          [style.background]="corDoPonto(t)"
                        ></i>
                        {{
                          t.isTransfer
                            ? rotuloTransferencia(t) + ' · fora do total'
                            : rotuloCategoria(t)
                        }}
                      </span>
                    </td>
                    <td class="suave">{{ nomeConta(t.accountId) }}</td>
                    <td class="num j-num" style="font-weight: 500">
                      <span [class]="classeValor(t).split(' ').pop()"
                        >{{ t.amountCents > 0 ? '+' : ''
                        }}{{ money(t.amountCents) }}</span
                      >
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="lista-m">
            <div class="blocao">
              @for (g of grupos(); track g.date) {
                <div class="dia-cab">
                  <span>{{ g.label }}</span>
                  @if (g.totalCents) {
                    <span class="j-num"
                      >{{ g.totalCents > 0 ? '+' : ''
                      }}{{ money(g.totalCents) }}</span
                    >
                  }
                </div>
                @for (t of g.items; track t.id) {
                  <button
                    type="button"
                    class="j-tx linha-m"
                    [attr.data-tx]="t.id"
                    [class.destaque]="destaque() === t.id"
                    [class.sel]="selecionadas().has(t.id)"
                    (click)="selecionando() ? marcar(t.id) : abrir(t)"
                  >
                    <jano-category-badge
                      [icon]="
                        t.isTransfer
                          ? 'assinatura'
                          : (cat(t.categoryId)?.icon ?? 'etiqueta')
                      "
                      [colorToken]="cat(t.categoryId)?.color ?? 'cat-1'"
                      [size]="32"
                    />
                    <span>
                      <span class="j-tx__name" style="display: block">{{
                        nomeTx(t.description)
                      }}</span>
                      <span class="j-tx__sub" style="display: block">
                        {{
                          t.isTransfer
                            ? rotuloTransferencia(t)
                            : rotuloCategoria(t)
                        }}
                        · {{ detalheConta(t) }}
                      </span>
                    </span>
                    <span [class]="classeValor(t)"
                      >{{ t.amountCents > 0 ? '+' : ''
                      }}{{ money(t.amountCents) }}</span
                    >
                  </button>
                }
              }
            </div>
          </div>

          @if (filtradas().length > visiveis().length) {
            <div class="mais">
              <button
                janoButton
                variant="secondary"
                type="button"
                (click)="limite.set(limite() + 50)"
              >
                Mostrar mais ({{ filtradas().length - visiveis().length }})
              </button>
            </div>
          }
        }

        @if (selecionadas().size) {
          <div
            class="acao-lote"
            role="region"
            aria-label="Ações para as selecionadas"
          >
            <span class="j-sub"
              ><b>{{ selecionadas().size }}</b> selecionadas ·
              {{ money(totalSelecionado()) }}</span
            >
            <select aria-label="Categoria para as selecionadas" #catLote>
              <option value="">Escolha a categoria</option>
              @for (c of categoriasOrdenadas(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
            <button
              janoButton
              variant="primary"
              [small]="true"
              type="button"
              [disabled]="!catLote.value"
              [carregando]="ocupado() && acaoLote() === 'categorizar'"
              textoCarregando="Aplicando…"
              (click)="acaoLote.set('categorizar'); aplicarLote(catLote.value)"
            >
              Categorizar
            </button>
            <button
              janoButton
              variant="secondary"
              [small]="true"
              type="button"
              [disabled]="ocupado() && acaoLote() !== 'transferir'"
              [carregando]="ocupado() && acaoLote() === 'transferir'"
              textoCarregando="Aplicando…"
              (click)="
                acaoLote.set('transferir');
                aplicarLote(selecaoSoTransferencias() ? '' : transferenciaId)
              "
            >
              {{
                selecaoSoTransferencias()
                  ? 'Resetar categoria'
                  : 'Marcar transferência'
              }}
            </button>
            <button
              janoButton
              variant="ghost"
              [small]="true"
              type="button"
              (click)="alternarSelecao()"
            >
              Cancelar
            </button>
          </div>
        }
      </main>

      @if (detalhe(); as d) {
        <button
          type="button"
          class="escurece so-estreito"
          aria-label="Fechar"
          (click)="fecharDetalhe()"
        ></button>
        <aside class="detalhe" aria-label="Detalhe da transação">
          <jano-detalhe-transacao
            [tx]="d"
            [categorias]="categoriasOrdenadas()"
            [conta]="nomeConta(d.accountId)"
            (fechar)="fecharDetalhe()"
            [salvando]="ocupado()"
            (salvar)="salvarDetalhe($event)"
          />
        </aside>
      }
    </div>
  `,
})
export class Transacoes {
  private readonly auth = inject(AuthService);
  private readonly progresso = inject(Progresso);
  private readonly repo = inject(TransactionsRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly rulesRepo = inject(RulesRepository);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /** `?tx=<id>`: abre no mês do lançamento e rola até ele, com destaque (vindo dos insights). */
  readonly tx = input<string>();
  /** `?conta=<id>` ("Ver compras do cartão"): abre filtrada nessa conta. */
  readonly conta = input<string>();
  /** Lançamento piscando depois de chegar por `?tx=`. */
  protected readonly destaque = signal<string | null>(null);

  protected readonly money = formatBRL;
  protected readonly classeValor = classeValor;
  protected readonly dataCurta = dataCurta;
  protected readonly transferenciaId = TRANSFERENCIA;
  private readonly fin = inject(PeriodoService);
  private readonly apelidos = inject(ApelidosService);
  private readonly toast = inject(Toast);
  /** Períodos ('AAAA-MM') de hoje e o anterior; do salário quando ele é conhecido. */
  protected readonly mesAtualStr = signal(mesAtual());
  protected readonly mesPassado = computed(() =>
    mesAnterior(this.mesAtualStr()),
  );
  protected readonly porSalario = this.fin.peloSalario;

  protected readonly periodo = signal<
    { tipo: 'mes'; mes: string } | { tipo: '3m' }
  >({ tipo: 'mes', mes: mesAtual() });
  protected readonly txs = signal<TransactionDoc[]>([]);
  protected readonly contas = signal<AccountDoc[]>([]);
  protected readonly categorias = signal<CategoryDoc[]>([]);
  protected readonly regras = signal<RuleDoc[]>([]);
  protected readonly filtros = signal<Filtros>(SEM_FILTROS);
  protected readonly filtrosAbertos = signal(false);
  protected readonly limite = signal(50);
  protected readonly detalheId = signal<string | null>(null);
  protected readonly selecionando = signal(false);
  protected readonly selecionadas = signal<Set<string>>(new Set());
  protected readonly carregando = signal(true);
  protected readonly ocupado = signal(false);
  /** Qual ação em lote está rodando, para só o botão dela mostrar o retorno. */
  protected readonly acaoLote = signal<'categorizar' | 'transferir' | null>(
    null,
  );
  protected readonly erro = signal('');
  protected readonly aviso = signal('');
  protected readonly previa = signal<Previa | null>(null);
  private arquivoKeyed: ReturnType<typeof addDedupeKeys> = [];

  protected readonly rotulo = computed(() => {
    const p = this.periodo();
    const nome = (k: string) =>
      this.porSalario() ? this.fin.rotulo(k) : rotuloMes(k);
    if (p.tipo === 'mes') return nome(p.mes);
    const desde = mesAnterior(mesAnterior(this.mesAtualStr()));
    return this.porSalario()
      ? `${calendario().inicio(desde).split('-').reverse().slice(0, 2).join('/')} até hoje`
      : `${nome(desde)} a ${nome(this.mesAtualStr())}`;
  });
  /** O mês corrente sem lançamentos é só começo de mês, não falta de importação. */
  protected readonly mesAtualVazio = computed(() => {
    const p = this.periodo();
    return p.tipo === 'mes' && p.mes === this.mesAtualStr();
  });
  protected readonly mesAnteriorRotulo = computed(() => {
    const p = this.periodo();
    if (p.tipo !== 'mes') return '';
    return this.porSalario()
      ? 'o período anterior'
      : rotuloMes(mesAnterior(p.mes)).split(' ')[0].toLowerCase();
  });
  protected readonly opcoesPeriodo = computed(() => [
    {
      id: 'este',
      rotulo: this.porSalario() ? 'Este período' : 'Este mês',
      ativo: this.periodoAtivo() === 'este',
    },
    {
      id: 'passado',
      rotulo: this.porSalario() ? 'Período passado' : 'Mês passado',
      ativo: this.periodoAtivo() === 'passado',
    },
    {
      id: '3m',
      rotulo: this.porSalario() ? 'Últimos 3 períodos' : 'Últimos 3 meses',
      ativo: this.periodo().tipo === '3m',
    },
  ]);
  /** Filtros do painel em uso, como chips removíveis ao lado dos rápidos. */
  protected readonly filtrosAtivos = computed(() => {
    const f = this.filtros();
    const out: { chave: string; rotulo: string }[] = [];
    if (f.tipo === 'transferencias')
      out.push({ chave: 'tipo', rotulo: 'Transferências' });
    if (f.conta) out.push({ chave: 'conta', rotulo: this.nomeConta(f.conta) });
    for (const id of f.categorias)
      out.push({
        chave: `cat:${id}`,
        rotulo: id ? (this.cat(id)?.name ?? 'Categoria') : 'Sem categoria',
      });
    return out;
  });
  protected readonly periodoAtivo = computed(() => {
    const p = this.periodo();
    if (p.tipo !== 'mes') return null;
    return p.mes === this.mesAtualStr()
      ? 'este'
      : p.mes === this.mesPassado()
        ? 'passado'
        : null;
  });
  protected readonly categoriasOrdenadas = computed(() =>
    [...this.categorias()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    ),
  );
  protected readonly filtradas = computed(() =>
    filtrar(
      this.txs(),
      this.filtros(),
      (id) => this.nomeCategoria2(id),
      this.cartoes(),
    ),
  );
  protected readonly totais = computed(() =>
    totalizar(this.filtradas(), this.filtros(), this.cartoes()),
  );
  protected readonly visiveis = computed(() =>
    this.filtradas().slice(0, this.limite()),
  );
  protected readonly grupos = computed(() => agruparPorDia(this.visiveis()));
  /** Ids das contas de cartão: crédito nelas é estorno, não receita. */
  protected readonly cartoes = computed(
    () =>
      new Set(
        this.contas()
          .filter((c) => c.type === 'cartao')
          .map((c) => c.id),
      ),
  );
  protected readonly semCategoriaN = computed(
    () => this.txs().filter((t) => !t.categoryId && !t.isTransfer).length,
  );
  protected readonly nFiltros = computed(() => totalDeFiltros(this.filtros()));
  protected readonly detalhe = computed(
    () => this.txs().find((t) => t.id === this.detalheId()) ?? null,
  );
  /** Todas as selecionadas já são transferência: o botão desfaz em vez de marcar. */
  protected readonly selecaoSoTransferencias = computed(() => {
    const sel = this.txs().filter((t) => this.selecionadas().has(t.id));
    return sel.length > 0 && sel.every((t) => t.isTransfer);
  });
  protected readonly totalSelecionado = computed(() =>
    this.txs()
      .filter((t) => this.selecionadas().has(t.id))
      .reduce((s, t) => s + t.amountCents, 0),
  );

  constructor() {
    void this.iniciar();
  }

  private get uid(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    return u.uid;
  }

  private async iniciar(): Promise<void> {
    try {
      await this.fin.garantir();
      this.mesAtualStr.set(this.fin.atual());
      this.periodo.set({ tipo: 'mes', mes: this.fin.atual() });
      const [contas, categorias, regras] = await Promise.all([
        this.catalog.accounts(this.uid),
        this.catalog.categories(this.uid),
        this.rulesRepo.list(this.uid),
      ]);
      this.contas.set(contas);
      this.categorias.set(categorias);
      this.regras.set(regras);
      // O router já entregou `?tx=` aqui: as leituras acima rodaram depois do construtor.
      const alvo = this.tx();
      const lancamento = alvo ? await this.repo.get(this.uid, alvo) : null;
      if (lancamento) {
        this.periodo.set({ tipo: 'mes', mes: monthOf(lancamento.date) });
        this.filtros.set(SEM_FILTROS);
      }
      const conta = this.conta();
      if (conta && contas.some((c) => c.id === conta)) this.mudar({ conta });
      await this.carregar();
      if (lancamento) this.irParaLancamento(lancamento.id);
    } catch (e) {
      this.falha(e);
    }
  }

  private carregar(): Promise<void> {
    return this.progresso.acompanhar(this.carregarDados());
  }

  private async carregarDados(): Promise<void> {
    this.carregando.set(true);
    this.limite.set(50);
    this.detalheId.set(null);
    this.selecionadas.set(new Set());
    try {
      // Um período pode atravessar dois meses do calendário: busca os dois e filtra.
      const p = this.periodo();
      const de =
        p.tipo === 'mes' ? p.mes : mesAnterior(mesAnterior(this.mesAtualStr()));
      const ate = p.tipo === 'mes' ? p.mes : this.mesAtualStr();
      const meses = [...mesesDoPeriodo(de), ...mesesDoPeriodo(ate)].sort();
      const lista = (
        meses.length === 1
          ? await this.repo.listMonth(this.uid, meses[0])
          : await this.repo.listRange(
              this.uid,
              meses[0],
              meses.at(-1) as string,
            )
      ).filter((t) => {
        const k = monthOf(t.date);
        return k >= de && k <= ate;
      });
      const r = await marcarTransferencias(this.repo, this.uid, lista);
      this.txs.set(r.txs);
      if (r.marcadas)
        this.aviso.set(
          `${r.marcadas} lançamentos (pagamento de fatura, aplicações) foram marcados como transferência e saíram dos totais.`,
        );
    } catch (e) {
      this.falha(e);
    } finally {
      this.carregando.set(false);
    }
  }

  /** Mostra o lançamento na lista, rola até ele e faz ele piscar. */
  private irParaLancamento(id: string): void {
    const i = this.filtradas().findIndex((t) => t.id === id);
    if (i < 0) return;
    if (i >= this.limite()) this.limite.set(i + 1);
    this.destaque.set(id);
    void this.router.navigate([], {
      queryParams: { tx: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    afterNextRender(
      () => {
        // Tabela (computador) e lista (celular) existem juntas; vale a que está visível.
        const el = [
          ...document.querySelectorAll<HTMLElement>(`[data-tx="${id}"]`),
        ].find((e) => e.offsetParent !== null);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => this.destaque.set(null), 3000);
      },
      { injector: this.injector },
    );
  }

  protected irPara(mes: string): void {
    this.periodo.set({ tipo: 'mes', mes });
    void this.carregar();
  }

  protected tresMeses(): void {
    this.periodo.set({ tipo: '3m' });
    void this.carregar();
  }

  protected mudarMes(delta: 1 | -1): void {
    const p = this.periodo();
    if (p.tipo !== 'mes') return;
    this.irPara(delta === 1 ? mesSeguinte(p.mes) : mesAnterior(p.mes));
  }

  protected mudar(parcial: Partial<Filtros>): void {
    this.filtros.update((f) => ({ ...f, ...parcial }));
    this.limite.set(50);
  }

  protected escolherPeriodo(id: string): void {
    if (id === 'este') this.irPara(this.mesAtualStr());
    else if (id === 'passado') this.irPara(this.mesPassado());
    else this.tresMeses();
  }

  protected removerFiltro(chave: string): void {
    if (chave === 'tipo') this.mudar({ tipo: null });
    else if (chave === 'conta') this.mudar({ conta: null });
    else this.alternarCategoria(chave.slice(4));
  }

  protected alternarTipo(tipo: TipoFiltro): void {
    this.mudar({ tipo: this.filtros().tipo === tipo ? null : tipo });
  }

  protected alternarCategoria(id: string): void {
    const atuais = this.filtros().categorias;
    this.mudar({
      categorias: atuais.includes(id)
        ? atuais.filter((x) => x !== id)
        : [...atuais, id],
    });
  }

  protected limpar(): void {
    this.filtros.set(SEM_FILTROS);
    this.limite.set(50);
  }

  protected cat(id: string | null): CategoryDoc | undefined {
    return id ? this.categorias().find((c) => c.id === id) : undefined;
  }

  protected corDoPonto(t: TransactionDoc): string {
    if (t.isTransfer) return 'var(--text-2)';
    const c = this.cat(t.categoryId);
    return c ? `var(--${c.color})` : 'var(--border-strong)';
  }

  protected nomeCategoria2(id: string | null): string {
    return this.cat(id)?.name ?? 'Sem categoria';
  }

  /** "Mercado", ou "Mercado + 1" quando o lançamento é dividido. */
  protected rotuloCategoria(t: TransactionDoc): string {
    const nome = this.nomeCategoria2(t.categoryId);
    return t.splits && t.splits.length > 1
      ? `${nome} + ${t.splits.length - 1}`
      : nome;
  }

  protected readonly nomeTx = nomeDeExibicao;
  protected readonly rotuloTransferencia = rotuloTransferencia;
  /** No celular: "Pix enviado" ou "Débito" diz mais que "Conta corrente"; senão, a conta. */
  protected detalheConta(t: TransactionDoc): string {
    return tipoDeOperacao(t.description) ?? this.nomeConta(t.accountId);
  }

  protected nomeConta(id: string): string {
    return this.contas().find((c) => c.id === id)?.nickname ?? '';
  }

  protected abrir(t: TransactionDoc): void {
    this.detalheId.set(t.id);
  }

  protected fecharDetalhe(): void {
    this.detalheId.set(null);
  }

  protected alternarSelecao(): void {
    this.selecionando.update((v) => !v);
    this.selecionadas.set(new Set());
    this.detalheId.set(null);
  }

  protected marcar(id: string): void {
    this.selecionadas.update((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  /**
   * Categoria (id), transferência (TRANSFERENCIA) ou '' para resetar: tira a transferência e
   * deixa sem categoria. Tudo fica como escolha manual, que a sincronização não troca.
   */
  protected async aplicarLote(escolha: string): Promise<void> {
    const ids = [...this.selecionadas()];
    if (!ids.length) return;
    const transferencia = escolha === TRANSFERENCIA;
    const categoryId = transferencia || !escolha ? null : escolha;
    this.ocupado.set(true);
    try {
      await this.repo.bulkUpdate(this.uid, ids, {
        categoryId,
        categoryIsManual: true,
        isTransfer: transferencia,
      });
      const set = new Set(ids);
      this.txs.update((l) =>
        l.map((t) =>
          set.has(t.id)
            ? {
                ...t,
                categoryId,
                categoryIsManual: true,
                isTransfer: transferencia,
                splits: undefined,
              }
            : t,
        ),
      );
      this.toast.mostrar(
        `${ids.length} transações ${
          transferencia
            ? 'marcadas como transferência'
            : categoryId
              ? `agora em ${this.nomeCategoria2(categoryId)}`
              : 'sem categoria'
        }.`,
      );
      this.selecionadas.set(new Set());
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async salvarDetalhe(ev: SalvarDetalhe): Promise<void> {
    const t = this.detalhe();
    if (!t) return;
    if (ev.apelido) {
      this.ocupado.set(true);
      try {
        const a = ev.apelido;
        if ('apelido' in a) await this.apelidos.salvar(a.pattern, a.apelido);
        if (a.removerId) await this.apelidos.remover(a.removerId);
        // Os nomes da lista vêm do apelido: redesenha com o novo.
        this.txs.update((l) => [...l]);
        if (!ev.mudouCategoria) {
          this.toast.mostrar(
            'apelido' in a
              ? `Agora aparece como “${a.apelido}”.`
              : 'Apelido removido.',
          );
          this.detalheId.set(null);
          return;
        }
      } catch (e) {
        this.falha(e);
        return;
      } finally {
        this.ocupado.set(false);
      }
    }
    if (!ev.mudouCategoria) return;
    if (ev.divisao) {
      this.ocupado.set(true);
      try {
        const splits = ev.divisao;
        const categoryId = await this.repo.setSplits(this.uid, t.id, splits);
        this.txs.update((l) =>
          l.map((x) =>
            x.id === t.id
              ? {
                  ...x,
                  splits,
                  categoryId,
                  categoryIsManual: true,
                  isTransfer: false,
                }
              : x,
          ),
        );
        this.toast.mostrar(`Dividida em ${splits.length} categorias.`);
        this.detalheId.set(null);
      } catch (e) {
        this.falha(e);
      } finally {
        this.ocupado.set(false);
      }
      return;
    }
    const transferencia = ev.escolha === TRANSFERENCIA;
    const categoryId = transferencia ? null : ev.escolha;
    const regraCat = ev.regra?.categoryId ?? null;
    this.ocupado.set(true);
    try {
      if (transferencia) await this.repo.setTransfer(this.uid, t.id);
      else await this.repo.setCategory(this.uid, t.id, categoryId);
      let outras: string[] = [];
      if (ev.regra?.futuras) {
        const regra = await this.rulesRepo.save(
          this.uid,
          ev.regra.pattern,
          ev.regra.categoryId,
        );
        this.regras.update((r) => [
          ...r.filter((x) => x.id !== regra.id),
          regra,
        ]);
      }
      if (ev.regra?.passadas)
        outras = (
          await this.repo.aplicarAsPassadas(
            this.uid,
            ev.regra.pattern,
            ev.regra.categoryId,
          )
        ).filter((id) => id !== t.id);
      const extra = new Set(outras);
      this.txs.update((l) =>
        l.map((x) =>
          x.id === t.id
            ? {
                ...x,
                categoryId,
                categoryIsManual: true,
                isTransfer: transferencia,
                splits: undefined,
              }
            : extra.has(x.id)
              ? { ...x, categoryId: regraCat, categoryIsManual: true }
              : x,
        ),
      );
      this.toast.mostrar(
        avisoDoSalvar(
          ev.regra,
          outras.length,
          transferencia ? null : this.nomeCategoria2(categoryId),
        ),
      );
      this.detalheId.set(null);
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  private nomeDaRegra(descriptionNorm: string): string | null {
    const regra = regraQueCasa(descriptionNorm, this.regras());
    return regra ? (this.cat(regra.categoryId)?.name ?? null) : null;
  }

  protected async escolherArquivo(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.erro.set('');
    this.aviso.set('');
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('O arquivo passa de 10 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ehPdf = /\.pdf$/i.test(file.name);
      let fatura: FaturaResult | undefined;
      let parsed: {
        transactions: Parameters<typeof addDedupeKeys>[1];
        errors: Previa['erros'];
      };
      if (ehPdf) {
        const linhas = await linhasDoPdf(bytes);
        if (!isFaturaBB(linhas)) {
          throw new Error(
            'Este PDF não parece uma fatura de cartão do Banco do Brasil.',
          );
        }
        fatura = parseFaturaBB(linhas);
        parsed = fatura;
      } else {
        parsed = parseOfx(decodeBytes(bytes));
      }
      if (!parsed.transactions.length) {
        throw new Error(
          'Não encontrei transações neste arquivo. Use o OFX do extrato ou o PDF da fatura.',
        );
      }
      const contas = this.contas();
      const accountId = ehPdf
        ? (contas.find((c) => c.type === 'cartao')?.id ?? contas[0]?.id ?? '')
        : (this.previa()?.accountId ?? contas[0]?.id ?? '');
      this.fatura = fatura;
      await this.montarPrevia(
        file.name,
        accountId,
        parsed.transactions,
        parsed.errors,
      );
    } catch (e) {
      this.falha(e);
    }
  }

  private fatura?: FaturaResult;
  private raw: Parameters<typeof addDedupeKeys>[1] = [];
  private errosArquivo: Previa['erros'] = [];

  private async montarPrevia(
    fileName: string,
    accountId: string,
    rows: Parameters<typeof addDedupeKeys>[1],
    erros: Previa['erros'],
  ): Promise<void> {
    this.raw = rows;
    this.errosArquivo = erros;
    this.arquivoKeyed = addDedupeKeys(accountId, rows);
    const dates = rows.map((r) => r.date).sort();
    const existentes = await this.repo.existingKeys(
      this.uid,
      dates[0],
      dates[dates.length - 1],
    );
    const plan = planImport(this.arquivoKeyed, existentes);
    const semSugestao = plan.fresh.filter((t) => !this.nomeCategoria(t)).length;
    this.previa.set({
      fileName,
      accountId,
      plan,
      erros,
      semSugestao,
      fatura: this.fatura,
    });
  }

  protected async trocarConta(ev: Event): Promise<void> {
    const p = this.previa();
    if (!p) return;
    try {
      await this.montarPrevia(
        p.fileName,
        (ev.target as HTMLSelectElement).value,
        this.raw,
        this.errosArquivo,
      );
    } catch (e) {
      this.falha(e);
    }
  }

  private nomeCategoria(tx: {
    descriptionNorm: string;
    bankCategory?: string;
    isTransfer?: boolean;
  }): string | null {
    // Regra sua vence até a detecção de transferência (como em `categorizar`).
    const daRegra = this.nomeDaRegra(tx.descriptionNorm);
    if (daRegra) return daRegra;
    if (tx.isTransfer) return null;
    return (
      suggestCategory(tx.descriptionNorm, DEFAULT_RULES) ??
      bankCategoryToName(tx.bankCategory)
    );
  }

  protected dataBr(iso: string | null): string {
    return iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  protected cancelar(): void {
    this.previa.set(null);
  }

  protected async confirmar(): Promise<void> {
    const p = this.previa();
    if (!p) return;
    this.ocupado.set(true);
    try {
      // Mesma decisão da sincronização: regra sua primeiro, depois o automático.
      const rows = categorizar(p.plan.fresh, this.categorias(), this.regras());
      const importId = crypto.randomUUID();
      await this.repo.commitImport(this.uid, p.accountId, importId, rows);
      await this.catalog.saveImportRecord(this.uid, importId, {
        accountId: p.accountId,
        fileName: p.fileName,
        added: rows.length,
        duplicates: p.plan.duplicates.length,
        errors: p.erros.length,
        createdAt: new Date().toISOString(),
      });
      this.previa.set(null);
      this.toast.mostrar(`${rows.length} transações importadas.`);
      if (p.plan.from)
        this.periodo.set({ tipo: 'mes', mes: monthOf(p.plan.from) });
      await this.carregar();
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  private falha(e: unknown): void {
    this.erro.set(
      e instanceof Error ? e.message : 'Tente de novo em instantes.',
    );
  }
}
