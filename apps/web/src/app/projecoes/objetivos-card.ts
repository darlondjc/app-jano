import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { AuthService, GoalsRepository, type GoalDoc } from '@jano/data-access';
import { formatBRL } from '@jano/engine';
import { parseAmountToCents } from '@jano/import-file';
import { NgTemplateOutlet } from '@angular/common';
import { JanoButton, JanoSkeletonCard, JanoSkeletonGroup } from '@jano/ui';
import { Progresso } from '../shell/progresso';
import { avaliarObjetivo, type BaseObjetivos } from './objetivos';

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
const mesCurto = (m: string) =>
  `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;

/** Valores por mês sem centavos: "R$ 1.908". */
const reais = (cents: number) =>
  formatBRL(Math.round(cents / 100) * 100).replace(/,00$/, '');

interface Rascunho {
  id?: string;
  criadoEm?: string;
  nome: string;
  alvo: string;
  prazo: string;
  fonte: GoalDoc['fonte'];
  guardado: string;
}

/** Objetivos de economia: quanto guardar por mês até o prazo e se a sobra média dá conta. */
@Component({
  selector: 'jano-objetivos',
  imports: [JanoButton, JanoSkeletonCard, JanoSkeletonGroup, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cab {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font: 600 18px/26px var(--font-sans);
    }
    .sub {
      font: 400 13px/18px var(--font-sans);
      color: var(--text-2);
    }
    .obj + .obj {
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .obj {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .linha {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .nome {
      font: 600 16px/22px var(--font-sans);
      overflow-wrap: anywhere;
    }
    .chip {
      font: 600 12px/1 var(--font-sans);
      padding: 5px 9px;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      color: var(--text-2);
      white-space: nowrap;
    }
    .chip.bom {
      background: var(--positive-soft);
      color: var(--positive);
    }
    .chip.atencao {
      background: var(--warning-soft);
      color: var(--warning-text);
    }
    .chip.perigo {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .trilho {
      height: 10px;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      overflow: hidden;
    }
    .trilho span {
      display: block;
      height: 100%;
      border-radius: var(--radius-pill);
      background: var(--primary);
    }
    .chave {
      font: 600 15px/22px var(--font-sans);
      font-variant-numeric: tabular-nums;
    }
    .editar {
      border: 0;
      background: none;
      padding: 4px;
      color: var(--text-2);
      cursor: pointer;
      border-radius: var(--radius-sm);
    }
    .editar:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .editar svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    form {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: var(--radius-md);
      background: var(--surface-2);
    }
    .dois {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }
    form .j-field,
    form .j-input {
      min-width: 0;
    }
    form input {
      min-width: 0;
      width: 100%;
    }
    .cab button {
      flex: none;
      white-space: nowrap;
    }
    .sub.passa {
      color: var(--warning-text);
      font-weight: 500;
    }
    .opcoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .erro {
      color: var(--danger);
      font: 500 13px/18px var(--font-sans);
    }
  `,
  template: `
    <section class="j-card" aria-label="Objetivos">
      <div class="cab">
        <div>
          <h2>Objetivos</h2>
          @if (resumo(); as r) {
            <div class="sub" [class.passa]="r.passa">{{ r.texto }}</div>
          }
        </div>
        @if (!rascunho()) {
          <button
            janoButton
            variant="secondary"
            [small]="true"
            type="button"
            (click)="novo()"
          >
            Novo objetivo
          </button>
        }
      </div>

      @if (carregando()) {
        <jano-skeleton-group label="Carregando objetivos">
          <jano-skeleton-card altura="96px" />
        </jano-skeleton-group>
      } @else {
        @for (o of avaliados(); track o.g.id) {
          @if (rascunho()?.id === o.g.id) {
            <ng-container *ngTemplateOutlet="formulario" />
          } @else {
            <div class="obj">
              <div class="linha">
                <span class="nome">{{ o.g.nome }}</span>
                <span class="linha" style="gap: 4px">
                  <span [class]="'chip ' + o.tom">{{ o.rotulo }}</span>
                  <button
                    class="editar"
                    type="button"
                    [attr.aria-label]="'Editar ' + o.g.nome"
                    (click)="editar(o.g)"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path
                        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
                      />
                    </svg>
                  </button>
                </span>
              </div>
              <div
                class="trilho"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="o.a.pct"
                [attr.aria-label]="o.g.nome"
              >
                <span [style.width.%]="o.a.pct"></span>
              </div>
              <div class="sub">
                {{ money(o.a.guardadoCents) }} de {{ money(o.g.alvoCents) }} ·
                {{
                  o.g.fonte === 'poupanca'
                    ? 'saldo da poupança'
                    : 'valor informado'
                }}
              </div>
              @if (o.a.situacao !== 'concluido') {
                <div class="chave">{{ o.chave }}</div>
              }
              @if (o.contexto) {
                <div class="sub">{{ o.contexto }}</div>
              }
            </div>
          }
        } @empty {
          @if (!rascunho()) {
            <div class="sub">
              Defina quanto quer juntar e até quando: o Jano mostra quanto
              guardar por mês e se a sua sobra média dá conta.
            </div>
          }
        }
        @if (rascunho() && !rascunho()!.id) {
          <ng-container *ngTemplateOutlet="formulario" />
        }
      }
    </section>

    <ng-template #formulario>
      @let r = rascunho()!;
      <form (submit)="salvar($event)">
        <label class="j-field">
          <span class="j-field__label">Nome</span>
          <span class="j-input"
            ><input
              [value]="r.nome"
              (input)="mudar({ nome: $any($event.target).value })"
              placeholder="Reserva de emergência"
              aria-label="Nome do objetivo"
          /></span>
        </label>
        <div class="dois">
          <label class="j-field">
            <span class="j-field__label">Quanto</span>
            <span class="j-input"
              ><span class="j-input__prefix">R$</span
              ><input
                inputmode="decimal"
                [value]="r.alvo"
                (input)="mudar({ alvo: $any($event.target).value })"
                placeholder="30.000,00"
                aria-label="Quanto quer juntar"
            /></span>
          </label>
          <label class="j-field">
            <span class="j-field__label">Até</span>
            <span class="j-input"
              ><input
                type="month"
                [value]="r.prazo"
                [min]="base().mesAtual"
                (input)="mudar({ prazo: $any($event.target).value })"
                aria-label="Prazo"
            /></span>
          </label>
        </div>
        <div>
          <div class="j-field__label" style="margin-bottom: 8px">
            Já guardado
          </div>
          <div class="opcoes" role="group" aria-label="Já guardado">
            @if (base().poupancaCents !== null) {
              <button
                class="j-chip"
                type="button"
                [attr.aria-pressed]="r.fonte === 'poupanca'"
                (click)="mudar({ fonte: 'poupanca' })"
              >
                Saldo da poupança ({{ money(base().poupancaCents ?? 0) }})
              </button>
            }
            <button
              class="j-chip"
              type="button"
              [attr.aria-pressed]="r.fonte === 'manual'"
              (click)="mudar({ fonte: 'manual' })"
            >
              Informar valor
            </button>
          </div>
        </div>
        @if (r.fonte === 'manual') {
          <label class="j-field">
            <span class="j-field__label">Quanto já tem</span>
            <span class="j-input"
              ><span class="j-input__prefix">R$</span
              ><input
                inputmode="decimal"
                [value]="r.guardado"
                (input)="mudar({ guardado: $any($event.target).value })"
                placeholder="0,00"
                aria-label="Quanto já tem guardado"
            /></span>
          </label>
        }
        @if (erro()) {
          <div class="erro" role="alert">{{ erro() }}</div>
        }
        <div class="acoes">
          <button
            janoButton
            variant="primary"
            type="submit"
            [disabled]="ocupado()"
          >
            Salvar
          </button>
          <button
            janoButton
            variant="ghost"
            type="button"
            (click)="rascunho.set(null)"
          >
            Cancelar
          </button>
          @if (r.id) {
            <button
              janoButton
              variant="ghost"
              type="button"
              style="margin-left: auto; color: var(--danger)"
              [disabled]="ocupado()"
              (click)="apagar(r.id)"
            >
              Apagar
            </button>
          }
        </div>
      </form>
    </ng-template>
  `,
})
export class ObjetivosCard {
  readonly base = input.required<BaseObjetivos>();

  private readonly repo = inject(GoalsRepository);
  private readonly auth = inject(AuthService);
  private readonly progresso = inject(Progresso);
  protected readonly money = formatBRL;
  protected readonly objetivos = signal<GoalDoc[]>([]);
  protected readonly carregando = signal(true);
  protected readonly rascunho = signal<Rascunho | null>(null);
  protected readonly erro = signal('');
  protected readonly ocupado = signal(false);

  protected readonly avaliados = computed(() =>
    this.objetivos().map((g) => {
      const a = avaliarObjetivo(g, this.base());
      const sobra = this.base().sobraMediaCents ?? 0;
      const quando = a.chegaEm ? mesCurto(a.chegaEm) : null;
      const [rotulo, tom, contexto] = {
        concluido: ['concluído', 'bom', 'Você já juntou o valor.'],
        'no-ritmo': [
          'cabe na sobra',
          'bom',
          `Cabe na sua sobra média de ${reais(sobra)} por mês.${quando ? ` No ritmo dela, chega em ${quando}.` : ''}`,
        ],
        apertado: [
          'apertado',
          'atencao',
          `${reais(a.porMesCents - sobra)} por mês acima da sua sobra média.${quando ? ` No ritmo atual, chega em ${quando}.` : ''}`,
        ],
        vencido: [
          'prazo passou',
          'perigo',
          `O prazo era ${mesCurto(g.prazo)}. Ajuste a data para recalcular.`,
        ],
        'sem-base': ['sem histórico', '', ''],
      }[a.situacao];
      return {
        g,
        a,
        rotulo,
        tom,
        contexto,
        chave:
          a.situacao === 'vencido'
            ? `Faltam ${formatBRL(a.faltaCents)}`
            : `Guardar ${reais(a.porMesCents)} por mês até ${mesCurto(g.prazo)}`,
      };
    }),
  );

  /**
   * Com mais de um objetivo, quanto todos pedem juntos contra a sobra média: cada um pode
   * caber sozinho e, somados, passar dela.
   */
  protected readonly resumo = computed(() => {
    const abertos = this.avaliados().filter(
      (o) => o.a.situacao !== 'concluido' && o.a.situacao !== 'vencido',
    );
    if (abertos.length < 2) return null;
    const total = abertos.reduce((s, o) => s + o.a.porMesCents, 0);
    const sobra = this.base().sobraMediaCents;
    if (sobra === null)
      return { texto: `Juntos pedem ${reais(total)} por mês.`, passa: false };
    return total > sobra
      ? {
          texto: `Juntos pedem ${reais(total)} por mês, ${reais(total - sobra)} acima da sua sobra média de ${reais(sobra)}.`,
          passa: true,
        }
      : {
          texto: `Juntos pedem ${reais(total)} por mês e cabem na sua sobra média de ${reais(sobra)}.`,
          passa: false,
        };
  });

  constructor() {
    void this.progresso.acompanhar(this.carregar());
  }

  private get uid(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    return u.uid;
  }

  private async carregar(): Promise<void> {
    try {
      this.objetivos.set(await this.repo.list(this.uid));
    } catch {
      // Sem objetivos lidos: o cartão fica vazio e permite criar.
    } finally {
      this.carregando.set(false);
    }
  }

  protected novo(): void {
    const [y, m] = this.base().mesAtual.split('-').map(Number);
    this.erro.set('');
    this.rascunho.set({
      nome: '',
      alvo: '',
      prazo: `${y + 1}-${String(m).padStart(2, '0')}`,
      fonte: this.base().poupancaCents !== null ? 'poupanca' : 'manual',
      guardado: '',
    });
  }

  protected editar(g: GoalDoc): void {
    const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    this.erro.set('');
    this.rascunho.set({
      id: g.id,
      criadoEm: g.criadoEm,
      nome: g.nome,
      alvo: reais(g.alvoCents),
      prazo: g.prazo,
      fonte: g.fonte,
      guardado: reais(g.guardadoCents),
    });
  }

  protected mudar(m: Partial<Rascunho>): void {
    this.rascunho.update((r) => (r ? { ...r, ...m } : r));
  }

  protected async salvar(ev: Event): Promise<void> {
    ev.preventDefault();
    const r = this.rascunho();
    if (!r) return;
    const alvoCents = parseAmountToCents(r.alvo);
    if (!r.nome.trim()) return this.erro.set('Dê um nome ao objetivo.');
    if (!alvoCents || alvoCents <= 0)
      return this.erro.set('Informe quanto quer juntar.');
    if (!/^\d{4}-\d{2}$/.test(r.prazo))
      return this.erro.set('Escolha até quando.');
    this.ocupado.set(true);
    try {
      const salvo = await this.repo.save(this.uid, {
        ...(r.id ? { id: r.id, criadoEm: r.criadoEm } : {}),
        nome: r.nome,
        alvoCents: Math.abs(alvoCents),
        prazo: r.prazo,
        fonte: r.fonte,
        guardadoCents: Math.abs(parseAmountToCents(r.guardado) ?? 0),
      });
      this.objetivos.update((l) =>
        [...l.filter((o) => o.id !== salvo.id), salvo].sort((a, b) =>
          a.prazo.localeCompare(b.prazo),
        ),
      );
      this.rascunho.set(null);
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Não foi possível salvar.',
      );
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async apagar(id: string): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.repo.remove(this.uid, id);
      this.objetivos.update((l) => l.filter((o) => o.id !== id));
      this.rascunho.set(null);
    } catch (e) {
      this.erro.set(
        e instanceof Error ? e.message : 'Não foi possível apagar.',
      );
    } finally {
      this.ocupado.set(false);
    }
  }
}
