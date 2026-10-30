import { diasDesde } from '../conta/tempo';

/** Depois de quantos dias sem importar o Início lembra a pessoa. */
export const DIAS_PARA_LEMBRAR = 7;
/** Quanto tempo o aviso fica quieto depois de dispensado. */
export const DIAS_DISPENSADO = 2;

/**
 * Lembrete "importe um novo extrato": aparece quando a última importação tem 7 dias ou mais
 * e some por 2 dias depois de dispensado. Sem nenhuma importação, quem cuida é o estado vazio.
 */
export function deveLembrar(
  ultimaImportacao: string | null,
  agora: Date,
  dispensadoEm: string | null,
): boolean {
  if (!ultimaImportacao) return false;
  if (diasDesde(ultimaImportacao, agora) < DIAS_PARA_LEMBRAR) return false;
  return !dispensadoEm || diasDesde(dispensadoEm, agora) >= DIAS_DISPENSADO;
}
