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
    version: '0.10.6',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Transações no celular mais enxuta: o período cabe numa linha só (toque no mês para escolher Este mês, Mês passado ou Últimos 3 meses) e os filtros rápidos quebram a linha em vez de sumir para o lado.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Filtros em uso aparecem como chips com × para tirar; "Sem categoria" só aparece quando há algo para categorizar; Selecionar virou um botão ao lado de Importar.',
      },
    ],
  },
  {
    version: '0.10.5',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Ao mudar a categoria de uma transação: "Alterar também as transações passadas" muda agora todas as já gravadas com o mesmo nome, e "Alterar também as transações futuras" vale para as que chegarem.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Botão para copiar o nome da transação e para limpar o trecho do nome, para montar o trecho mais rápido.',
      },
      {
        tipo: 'correcao',
        texto:
          'No celular, transação com nome longo e sem espaço ("MERCADOLIVRE*...") quebra a linha em vez de esconder o valor.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Orçamento ganhou o mesmo seletor de mês de Transações: mês centralizado entre as setas.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Na seleção de transações, se todas já são transferência, o botão vira "Resetar categoria": deixam de ser transferência e ficam sem categoria.',
      },
      {
        tipo: 'correcao',
        texto:
          'A sincronização diária não troca mais categorias que já existem: só preenche as que estão vazias. Regras genéricas como "COMPRA C CARTAO" são ignoradas e, quando duas regras valem, vence a mais específica.',
      },
    ],
  },
  {
    version: '0.10.4',
    date: '2026-10-31',
    items: [
      {
        tipo: 'correcao',
        texto:
          'Na compra no débito ("COMPRA C/CARTAO 27/10 17:15 LOJA"), a regra proposta passa a ser o nome da loja. Antes era "COMPRA C CARTAO", que pegaria todas as compras no débito.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Lançamento sem categoria recebe a de outras compras na mesma loja, priorizando a que você escolheu à mão. Vale para o histórico inteiro, na sincronização diária.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Maiores estabelecimentos e Recorrências juntam as compras no débito da mesma loja, mesmo com horários diferentes.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Transações: período redesenhado, com as opções num controle só e o mês centralizado entre as setas. Sai o resumo abaixo do título.',
      },
    ],
  },
  {
    version: '0.10.3',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Recorrências: cada grupo abre e fecha, mostra quantos itens tem e o total do mês, e o app lembra quais você deixou fechados.',
      },
      {
        tipo: 'melhoria',
        texto:
          'YouTube, Apple, HBO, Prime Video, Globoplay, Deezer, Claude, ChatGPT e outros streamings passam a ser reconhecidos como assinaturas.',
      },
    ],
  },
  {
    version: '0.10.2',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Suas regras de categoria passam a valer para o histórico inteiro na sincronização diária, corrigindo categorias automáticas antigas. O que você escolheu à mão não muda.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Recorrências separadas em assinaturas, contas fixas, parcelamentos e entradas, com o total de cada grupo. Parcelamentos mostram a parcela atual e quando terminam.',
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Mais lançamentos chegam categorizados pelo Open Finance: pelo categorizador da Pluggy e, no cartão, pelo ramo do estabelecimento. Os que estavam sem categoria são reavaliados a cada sincronização.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Resumos mais limpos: saem as legendas explicativas dos indicadores do Início e de Transações.',
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Dividir um lançamento em várias categorias: no detalhe da transação, cada parte conta na sua categoria nas metas e nas avaliações.',
      },
      {
        tipo: 'novo',
        texto:
          'O app abre sem internet e mostra os últimos dados vistos, com o aviso de quando são. Importar e editar voltam com a conexão.',
      },
      {
        tipo: 'novo',
        texto:
          'Aviso no topo quando a autorização do Open Finance está para vencer (15 dias antes), venceu ou a sincronização parou.',
      },
      {
        tipo: 'novo',
        texto:
          'Metas podem levar a sobra para o mês seguinte: o que não for gasto soma ao limite do próximo mês.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Insights podem ser dispensados nas Avaliações; somem também do Início até o fim do mês.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Os cenários "e se" das Projeções ficam salvos como você deixou, em qualquer aparelho.',
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Saldo atual no Início: a soma da conta corrente e da poupança, direto do banco pelo Open Finance, com a data da última atualização.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Projeções parte do saldo do banco quando ele existe, sem precisar digitar.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Ícone do app instalado com a chave um pouco menor, mais equilibrado na tela inicial.',
      },
    ],
  },
  {
    version: '0.8.3',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Sincronização diária com o Open Finance (Meu Pluggy): as transações do banco chegam sozinhas toda manhã, sem importar arquivo.',
      },
      {
        tipo: 'correcao',
        texto:
          'Resgates do BB Rende Fácil abreviados no extrato ("REND.FACIL") agora contam como transferência, não como receita.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Compras em supermercados e restaurantes passam a ser categorizadas automaticamente.',
      },
    ],
  },
  {
    version: '0.8.2',
    date: '2026-10-30',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'O app abre mais rápido: o carregamento inicial ficou cerca de 40% menor (de 240 KB para 147 KB transferidos).',
      },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'O Início avisa quando faz 7 dias ou mais desde a última importação, com atalho para importar um novo extrato.',
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Tela Recorrências: assinaturas, contas fixas e entradas que se repetem, com próxima data, aviso de reajuste, totais mensais e calendário do mês.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Tela Projeções: saldo previsto para 3, 6 ou 12 meses com faixa de incerteza, cenários "e se" (cortar categoria, nova parcela, renda extra) e próximas cobranças recorrentes.',
      },
      {
        tipo: 'melhoria',
        texto:
          'No celular, o menu ganhou a aba "Mais" com Avaliações, Categorias, Conta e dados e Novidades.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Tela Avaliações: leitura do mês em uma frase, nota de 0 a 100 com explicação, insights com ação, comparativo mês a mês por categoria, distribuição do gasto e os 5 maiores estabelecimentos.',
      },
    ],
  },
  {
    version: '0.5.2',
    date: '2026-10-30',
    items: [
      {
        tipo: 'correcao',
        texto:
          'Estornos e reembolsos no cartão agora abatem o gasto em vez de contar como receita.',
      },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-10-30',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Enquanto os dados carregam, as telas mostram esqueletos no formato do conteúdo em vez de textos de espera.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Avatar com suas iniciais no topo, com menu da conta (Conta e dados, Novidades, Ocultar valores e Sair).',
      },
      {
        tipo: 'novo',
        texto:
          'Tela Conta e dados: última importação, verificar atualização do app, ocultar valores e exportar ou apagar seus dados.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-30',
    items: [
      {
        tipo: 'novo',
        texto:
          'Transações redesenhada: tabela no computador, busca, filtros, período, detalhe do lançamento e seleção em lote.',
      },
      {
        tipo: 'novo',
        texto:
          'Início com indicadores do mês, gráfico de gasto acumulado com ritmo ideal e projeção, e alertas.',
      },
      {
        tipo: 'novo',
        texto:
          'Ao recategorizar, dá para criar uma regra e aplicá-la aos lançamentos parecidos.',
      },
      {
        tipo: 'novo',
        texto:
          'Barra de progresso no topo durante carregamentos e botão para voltar ao topo da página.',
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-10-30',
    items: [
      {
        tipo: 'correcao',
        texto:
          'Pagamento de fatura, aplicações e resgates deixam de contar como gasto ou receita; dá para marcar qualquer lançamento como transferência.',
      },
      {
        tipo: 'correcao',
        texto: 'O mês exibido não vira para o seguinte antes da hora à noite.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-27',
    items: [
      {
        tipo: 'novo',
        texto:
          'Menu lateral no computador e barra de abas no celular, em todas as telas.',
      },
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
