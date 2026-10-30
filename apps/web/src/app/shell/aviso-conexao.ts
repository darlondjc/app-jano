import type { ConnectionDoc } from '@jano/data-access';

export interface AvisoConexao {
  tom: 'warn' | 'danger';
  titulo: string;
  texto: string;
  acao: { rotulo: string; href: string };
}

/** Onde renovar: Applications → sua aplicação → Demo → Connect Account → MeuPluggy. */
export const RENOVAR_URL = 'https://dashboard.pluggy.ai';
/** Onde rodar a sincronização à mão (Run workflow). */
export const SINCRONIZAR_URL =
  'https://github.com/darlondjc/app-jano/actions/workflows/pluggy-sync.yml';

/** O design pede o aviso 15 dias antes de vencer. */
const DIAS_ANTES = 15;
/** A sincronização roda todo dia; dois dias sem rodar é falha. */
const HORAS_SEM_SINCRONIZAR = 48;
const DIA = 86_400_000;

const MESES = [
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

function dataLonga(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/**
 * O aviso mais grave entre as conexões Open Finance, ou `null` se está tudo em dia.
 * Ordem: autorização vencida, sincronização parada, autorização perto de vencer.
 */
export function avisoConexao(
  conexoes: ConnectionDoc[],
  agora = new Date(),
): AvisoConexao | null {
  const renovar = { rotulo: 'Renovar', href: RENOVAR_URL };
  const vencida = conexoes.some(
    (c) =>
      c.errorCode === 'USER_AUTHORIZATION_EXPIRED' ||
      (!!c.consentExpiresAt &&
        Date.parse(c.consentExpiresAt) <= agora.getTime()),
  );
  if (vencida)
    return {
      tom: 'danger',
      titulo: 'O consentimento expirou.',
      texto:
        'Suas transações deixaram de chegar. Renove no Meu Pluggy para voltar a sincronizar.',
      acao: renovar,
    };

  const parada = conexoes.find(
    (c) =>
      c.status === 'LOGIN_ERROR' ||
      c.status === 'OUTDATED' ||
      agora.getTime() - Date.parse(c.syncedAt) >
        HORAS_SEM_SINCRONIZAR * 3_600_000,
  );
  if (parada)
    return {
      tom: 'danger',
      titulo: 'A sincronização falhou.',
      texto: `Seus dados estão salvos, mas não atualizados desde ${dataLonga(parada.bankUpdatedAt ?? parada.syncedAt)}.`,
      acao: { rotulo: 'Tentar de novo', href: SINCRONIZAR_URL },
    };

  const dias = conexoes
    .filter((c) => c.consentExpiresAt)
    .map((c) =>
      Math.ceil(
        (Date.parse(c.consentExpiresAt as string) - agora.getTime()) / DIA,
      ),
    )
    .sort((a, b) => a - b)[0];
  if (dias !== undefined && dias <= DIAS_ANTES)
    return {
      tom: 'warn',
      titulo:
        dias === 1
          ? 'O consentimento expira amanhã.'
          : `O consentimento expira em ${dias} dias.`,
      texto: 'Renove para continuar sincronizando suas transações.',
      acao: renovar,
    };
  return null;
}
