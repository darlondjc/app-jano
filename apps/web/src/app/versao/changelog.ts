export type TipoMudanca = 'novo' | 'melhoria' | 'correcao';

export interface Versao {
  version: string;
  /** AAAA-MM-DD; opcional nas versões antigas. */
  date?: string;
  items: { tipo: TipoMudanca; texto: string }[];
}

/**
 * Histórico para o usuário, da versão mais nova para a mais antiga.
 * A primeira entrada é a versão atual do app (tools/build-version.mjs lê daqui).
 * Ao publicar algo que o usuário perceba, acrescente uma entrada no topo.
 */
export const CHANGELOG: Versao[] = [
  {
    version: '0.3.0',
    date: '2026-10-27',
    items: [
      { tipo: 'novo', texto: 'Tela de novidades com o histórico de versões.' },
      {
        tipo: 'novo',
        texto:
          'O app avisa quando há uma versão nova e atualiza com um clique, sem perder o que você estava vendo.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Entradas em verde e saídas em vermelho nas transações e nos resumos; transferências em cinza.',
      },
      {
        tipo: 'melhoria',
        texto: 'Categorias em ordem alfabética na tela de transações.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Links viraram botões e os três cartões do início têm o mesmo tamanho.',
      },
    ],
  },
  {
    version: '0.2.0',
    items: [
      {
        tipo: 'novo',
        texto:
          'Importação da fatura do cartão do Banco do Brasil em PDF, com conferência dos totais.',
      },
      {
        tipo: 'novo',
        texto: 'Tela de categorias: crie, edite e exclua, com ícone e cor.',
      },
    ],
  },
  {
    version: '0.1.0',
    items: [
      { tipo: 'novo', texto: 'Entrada com a conta Google.' },
      {
        tipo: 'novo',
        texto: 'Importação de extrato OFX, sem duplicar lançamentos.',
      },
      {
        tipo: 'novo',
        texto: 'Orçamento por categoria e tela inicial com o resumo do mês.',
      },
    ],
  },
];

export const VERSAO_ATUAL = CHANGELOG[0].version;
