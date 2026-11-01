/**
 * Período financeiro: do dia em que o salário cai até a véspera do próximo. Cada período tem
 * uma chave 'AAAA-MM', a do mês em que o salário dele é previsto (o de 5/out a 4/nov é
 * '2026-10'), então tudo o que agrupa "por mês" passa a agrupar por período sem mudar de forma.
 *
 * Sem salário conhecido, o período é o mês do calendário (é o padrão do engine).
 */
export interface CalendarioFinanceiro {
  /** Chave 'AAAA-MM' do período que contém a data. */
  chave(date: string): string;
  /** Primeiro e último dia (AAAA-MM-DD) do período. */
  inicio(chave: string): string;
  fim(chave: string): string;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoUTC(d);
};
const somarMesesChave = (chave: string, n: number) => {
  const [y, m] = chave.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${doisDigitos((t % 12) + 1)}`;
};
const ultimoDia = (chave: string) => {
  const [y, m] = chave.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const diasEntre = (de: string, ate: string) =>
  Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) /
      86_400_000,
  );

/** Mês do calendário: o comportamento de sempre. */
export const CALENDARIO_DO_MES: CalendarioFinanceiro = {
  chave: (date) => date.slice(0, 7),
  inicio: (chave) => `${chave}-01`,
  fim: (chave) => `${chave}-${doisDigitos(ultimoDia(chave))}`,
};

/**
 * Calendário pelos salários: `chegadas` são as datas em que o salário caiu de fato e `dia` o
 * dia do mês em que ele costuma cair (para os meses sem chegada conhecida, inclusive o
 * próximo). Uma chegada adiantada (fim de semana, feriado) começa o período nela.
 */
export function calendarioPeloSalario(
  chegadas: string[],
  dia: number,
): CalendarioFinanceiro {
  const previsto = (chave: string) =>
    `${chave}-${doisDigitos(Math.min(dia, ultimoDia(chave)))}`;
  // Cada chegada vale para o mês cuja data prevista está mais perto dela.
  const real = new Map<string, string>();
  for (const c of [...chegadas].sort()) {
    const candidatos = [-1, 0, 1].map((n) => somarMesesChave(c.slice(0, 7), n));
    const chave = candidatos.reduce((melhor, k) =>
      Math.abs(diasEntre(previsto(k), c)) <
      Math.abs(diasEntre(previsto(melhor), c))
        ? k
        : melhor,
    );
    // A primeira chegada do mês é a que abre o período (um segundo crédito não reabre).
    if (!real.has(chave)) real.set(chave, c);
  }
  const inicio = (chave: string) => real.get(chave) ?? previsto(chave);
  const fim = (chave: string) =>
    somarDias(inicio(somarMesesChave(chave, 1)), -1);
  return {
    inicio,
    fim,
    chave(date) {
      const mes = date.slice(0, 7);
      if (date >= inicio(somarMesesChave(mes, 1)))
        return somarMesesChave(mes, 1);
      if (date >= inicio(mes)) return mes;
      return somarMesesChave(mes, -1);
    },
  };
}

let atual: CalendarioFinanceiro = CALENDARIO_DO_MES;

/** Troca o calendário usado em todo o engine (o app chama ao descobrir o salário). */
export function definirCalendario(c: CalendarioFinanceiro | null): void {
  atual = c ?? CALENDARIO_DO_MES;
}

export function calendario(): CalendarioFinanceiro {
  return atual;
}

/** Chave do período da data: 'AAAA-MM' (o mês, quando não há salário conhecido). */
export const periodoDe = (date: string): string => atual.chave(date);

/** Quantos dias o período tem. */
export function diasNoPeriodo(chave: string): number {
  return diasEntre(atual.inicio(chave), atual.fim(chave)) + 1;
}

/** Dia da data dentro do período dela, a partir de 1. */
export function diaNoPeriodo(date: string): number {
  return diasEntre(atual.inicio(atual.chave(date)), date) + 1;
}

/** Fração do período decorrida até `hoje` (0–1), contando o dia de hoje. */
export function ritmoDoPeriodo(chave: string, hoje: string): number {
  if (hoje > atual.fim(chave)) return 1;
  if (hoje < atual.inicio(chave)) return 0;
  return diaNoPeriodo(hoje) / diasNoPeriodo(chave);
}

/** Dias que faltam no período depois de hoje. */
export function diasRestantesNoPeriodo(chave: string, hoje: string): number {
  return Math.max(diasEntre(hoje, atual.fim(chave)), 0);
}

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
const curta = (iso: string) =>
  `${Number(iso.slice(8, 10))}/${MESES[Number(iso.slice(5, 7)) - 1]}`;

/** "5/out – 4/nov". */
export function rotuloDoPeriodo(chave: string): string {
  return `${curta(atual.inicio(chave))} – ${curta(atual.fim(chave))}`;
}

/** Meses do calendário (AAAA-MM) que o período toca, para buscar os lançamentos. */
export function mesesDoPeriodo(chave: string): string[] {
  const out: string[] = [];
  let m = atual.inicio(chave).slice(0, 7);
  const ate = atual.fim(chave).slice(0, 7);
  while (m <= ate) {
    out.push(m);
    m = somarMesesChave(m, 1);
  }
  return out;
}
