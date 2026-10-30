import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { formatBRL } from '@jano/engine';
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
} from '@jano/import-file';
import {
  JanoBanner,
  JanoButton,
  JanoCategoryBadge,
  JanoSkeleton,
  JanoSkeletonGroup,
  JanoSkeletonRows,
} from '@jano/ui';
import {
  agruparPorDia,
  classeValor,
  dataCurta,
  gastosDoMes,
  mesAnterior,
  mesAtual,
  mesSeguinte,
  rotuloMes,
} from './agrupar';
import { DetalheTransacao, TRANSFERENCIA, type SalvarDetalhe } from './detalhe';
import {
  filtrar,
  SEM_FILTROS,
  totalDeFiltros,
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
    JanoButton,
    JanoBanner,
    JanoCategoryBadge,
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
    header.topo {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    header label.imp {
      flex: none;
    }
    h1 {
      margin: 0;
      font: 600 28px/36px var(--font-sans);
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
    .linha-chips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      align-items: center;
    }
    .linha-chips .j-chip {
      flex: none;
    }
    .linha-chips.periodo {
      flex-wrap: wrap;
      overflow: visible;
    }
    .nav-mes {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: none;
      margin-left: 8px;
    }
    .nav-mes strong {
      font: 600 14px/20px var(--font-sans);
      min-width: 110px;
      text-align: center;
    }
    .resumo {
      margin-top: 4px;
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
      overflow: auto;
      background: var(--surface);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      box-shadow: var(--shadow-sheet);
      padding: 20px 16px 24px;
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
      max-height: 300px;
      overflow: auto;
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
      grid-template-columns: auto 1fr auto;
      align-items: center;
      column-gap: 12px;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .linha-m.sel {
      background: var(--primary-soft);
    }
    .lista-m .blocao {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
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
    .dia {
      margin: 16px 0 4px;
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
    }
    @media (max-width: 899px) {
      .acao-lote {
        bottom: 88px;
      }
    }
  `,
  template: `
    <header class="topo">
      <div>
        <h1>Transações</h1>
        @if (carregando()) {
          <jano-skeleton w="320px" h="14px" style="margin-top: 10px" />
        } @else {
          <div class="j-sub resumo">
            {{ visiveis().length }} de {{ filtradas().length }} transações ·
            gastos de {{ money(gastos()) }}
            <span class="j-cap">(transferências ficam de fora)</span>
          </div>
        }
      </div>
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
    </header>

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
          [attr.aria-pressed]="!filtros().tipo && !filtros().semCategoria"
          (click)="mudar({ tipo: null, semCategoria: false })"
        >
          Todas
        </button>
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
          class="j-chip ocultar-largo"
          type="button"
          (click)="filtrosAbertos.set(true)"
        >
          Filtros
          @if (nFiltros()) {
            · {{ nFiltros() }}
          }
        </button>
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="filtros().semCategoria"
          (click)="mudar({ semCategoria: !filtros().semCategoria })"
        >
          Sem categoria · {{ semCategoriaN() }}
        </button>
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="selecionando()"
          (click)="alternarSelecao()"
        >
          Selecionar
        </button>
      </div>
      <div class="linha-chips periodo" role="group" aria-label="Período">
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="periodoAtivo() === 'este'"
          (click)="irPara(mesAtualStr)"
        >
          Este mês
        </button>
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="periodoAtivo() === 'passado'"
          (click)="irPara(mesPassado)"
        >
          Mês passado
        </button>
        <button
          class="j-chip"
          type="button"
          [attr.aria-pressed]="periodo().tipo === '3m'"
          (click)="tresMeses()"
        >
          3 meses
        </button>
        <span class="nav-mes">
          @if (periodo().tipo === 'mes') {
            <button
              janoButton
              variant="ghost"
              [small]="true"
              type="button"
              aria-label="Mês anterior"
              (click)="mudarMes(-1)"
            >
              ‹
            </button>
          }
          <strong>{{ rotulo() }}</strong>
          @if (periodo().tipo === 'mes') {
            <button
              janoButton
              variant="ghost"
              [small]="true"
              type="button"
              aria-label="Próximo mês"
              (click)="mudarMes(1)"
            >
              ›
            </button>
          }
        </span>
      </div>
    </div>

    @if (erro()) {
      <jano-banner tone="danger" title="Algo deu errado.">{{
        erro()
      }}</jano-banner>
    }
    @if (aviso()) {
      <jano-banner tone="good">{{ aviso() }}</jano-banner>
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
            [disabled]="ocupado() || !p.plan.fresh.length"
            (click)="confirmar()"
          >
            {{
              ocupado()
                ? 'Gravando...'
                : 'Importar ' + p.plan.fresh.length + ' transações'
            }}
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
        <div style="display: flex; gap: 8px">
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
            <div class="j-empty__title">Nenhuma transação neste período</div>
            <div class="j-empty__text">
              Importe o extrato (OFX) da conta ou a fatura do cartão (PDF) do
              Banco do Brasil para começar.
            </div>
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
                          [attr.aria-label]="'Selecionar ' + t.description"
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
                        {{ t.description }}
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
                            ? 'Transferência · fora do total'
                            : nomeCategoria2(t.categoryId)
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
            @for (g of grupos(); track g.date) {
              <div class="j-day dia" style="padding-left: 0">{{ g.label }}</div>
              <div class="blocao">
                @for (t of g.items; track t.id) {
                  <button
                    type="button"
                    class="j-tx linha-m"
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
                        t.description
                      }}</span>
                      <span class="j-tx__sub" style="display: block">
                        {{
                          t.isTransfer
                            ? 'Transferência'
                            : nomeCategoria2(t.categoryId)
                        }}
                        · {{ nomeConta(t.accountId) }}
                      </span>
                    </span>
                    <span [class]="classeValor(t)"
                      >{{ t.amountCents > 0 ? '+' : ''
                      }}{{ money(t.amountCents) }}</span
                    >
                  </button>
                }
              </div>
            }
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
              [disabled]="!catLote.value || ocupado()"
              (click)="aplicarLote(catLote.value)"
            >
              Categorizar
            </button>
            <button
              janoButton
              variant="secondary"
              [small]="true"
              type="button"
              [disabled]="ocupado()"
              (click)="aplicarLote(transferenciaId)"
            >
              Marcar transferência
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

  protected readonly money = formatBRL;
  protected readonly classeValor = classeValor;
  protected readonly dataCurta = dataCurta;
  protected readonly transferenciaId = TRANSFERENCIA;
  protected readonly mesAtualStr = mesAtual();
  protected readonly mesPassado = mesAnterior(mesAtual());

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
  protected readonly erro = signal('');
  protected readonly aviso = signal('');
  protected readonly previa = signal<Previa | null>(null);
  private arquivoKeyed: ReturnType<typeof addDedupeKeys> = [];

  protected readonly rotulo = computed(() => {
    const p = this.periodo();
    return p.tipo === 'mes'
      ? rotuloMes(p.mes)
      : `${rotuloMes(mesAnterior(mesAnterior(mesAtual())))} a ${rotuloMes(mesAtual())}`;
  });
  protected readonly periodoAtivo = computed(() => {
    const p = this.periodo();
    if (p.tipo !== 'mes') return null;
    return p.mes === this.mesAtualStr
      ? 'este'
      : p.mes === this.mesPassado
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
  protected readonly gastos = computed(() =>
    gastosDoMes(this.filtradas(), this.cartoes()),
  );
  protected readonly semCategoriaN = computed(
    () => this.txs().filter((t) => !t.categoryId && !t.isTransfer).length,
  );
  protected readonly nFiltros = computed(() => totalDeFiltros(this.filtros()));
  protected readonly detalhe = computed(
    () => this.txs().find((t) => t.id === this.detalheId()) ?? null,
  );
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
      const [contas, categorias, regras] = await Promise.all([
        this.catalog.accounts(this.uid),
        this.catalog.categories(this.uid),
        this.rulesRepo.list(this.uid),
      ]);
      this.contas.set(contas);
      this.categorias.set(categorias);
      this.regras.set(regras);
      await this.carregar();
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
      const p = this.periodo();
      const lista =
        p.tipo === 'mes'
          ? await this.repo.listMonth(this.uid, p.mes)
          : await this.repo.listRange(
              this.uid,
              mesAnterior(mesAnterior(mesAtual())),
              mesAtual(),
            );
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

  protected async aplicarLote(escolha: string): Promise<void> {
    const ids = [...this.selecionadas()];
    if (!ids.length) return;
    const transferencia = escolha === TRANSFERENCIA;
    this.ocupado.set(true);
    try {
      await this.repo.bulkUpdate(this.uid, ids, {
        categoryId: transferencia ? null : escolha,
        categoryIsManual: true,
        isTransfer: transferencia,
      });
      const set = new Set(ids);
      this.txs.update((l) =>
        l.map((t) =>
          set.has(t.id)
            ? {
                ...t,
                categoryId: transferencia ? null : escolha,
                categoryIsManual: true,
                isTransfer: transferencia,
              }
            : t,
        ),
      );
      this.aviso.set(`${ids.length} lançamentos atualizados.`);
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
    const transferencia = ev.escolha === TRANSFERENCIA;
    const categoryId = transferencia ? null : ev.escolha;
    const regraCat = ev.regra?.categoryId ?? null;
    this.ocupado.set(true);
    try {
      if (transferencia) await this.repo.setTransfer(this.uid, t.id);
      else await this.repo.setCategory(this.uid, t.id, categoryId);
      let outras: string[] = [];
      if (ev.regra) {
        const regra = await this.rulesRepo.save(
          this.uid,
          ev.regra.pattern,
          ev.regra.categoryId,
        );
        this.regras.update((r) => [
          ...r.filter((x) => x.id !== regra.id),
          regra,
        ]);
        outras = this.txs()
          .filter(
            (x) =>
              x.id !== t.id &&
              !x.categoryIsManual &&
              !x.isTransfer &&
              x.descriptionNorm.includes(regra.pattern),
          )
          .map((x) => x.id);
        if (outras.length)
          await this.repo.bulkUpdate(this.uid, outras, {
            categoryId: ev.regra.categoryId,
            categoryIsManual: false,
            isTransfer: false,
          });
      }
      const extra = new Set(outras);
      this.txs.update((l) =>
        l.map((x) =>
          x.id === t.id
            ? {
                ...x,
                categoryId,
                categoryIsManual: true,
                isTransfer: transferencia,
              }
            : extra.has(x.id)
              ? { ...x, categoryId: regraCat }
              : x,
        ),
      );
      this.aviso.set(
        ev.regra
          ? `Regra criada. ${outras.length} outros lançamentos deste período foram atualizados.`
          : 'Salvo.',
      );
      this.detalheId.set(null);
    } catch (e) {
      this.falha(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  private nomeDaRegra(descriptionNorm: string): string | null {
    const regra = this.regras().find((r) =>
      descriptionNorm.includes(r.pattern),
    );
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
    if (tx.isTransfer) return null;
    return (
      this.nomeDaRegra(tx.descriptionNorm) ??
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
      const catIds = new Set(this.categorias().map((c) => c.id));
      const rows = p.plan.fresh.map((raw) => {
        const tx = {
          ...raw,
          isTransfer: raw.isTransfer || isLikelyTransfer(raw.descriptionNorm),
        };
        const nome = this.nomeCategoria(tx);
        const id = nome
          ? (this.categorias().find((c) => c.name === nome)?.id ??
            slugify(nome))
          : null;
        return {
          tx,
          categoryId: !tx.isTransfer && id && catIds.has(id) ? id : null,
        };
      });
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
      this.aviso.set(`${rows.length} transações importadas.`);
      if (p.plan.from)
        this.periodo.set({ tipo: 'mes', mes: p.plan.from.slice(0, 7) });
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
