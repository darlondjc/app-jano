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
    version: '0.20.1',
    date: '2026-11-01',
    items: [
      {
        tipo: 'correcao',
        texto:
          'O cartão da fatura escolhe, entre as faturas que o banco manda, a que corresponde à atual (pelo vencimento), mesmo quando a próxima já aparece na lista.',
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Fatura com o valor do banco: a sincronização passa a buscar as faturas fechadas pelo Open Finance. Quando o banco manda, o cartão mostra o valor, o vencimento e o pagamento mínimo oficiais, iguais aos do app do banco. Sem isso, continua a soma das compras do ciclo, agora com o aviso de que pode diferir (encargos, ajustes).',
      },
      {
        tipo: 'melhoria',
        texto:
          'Ao informar o fechamento, a dica explica: é a véspera do "melhor dia de compra" do app do banco.',
      },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'novo',
        texto:
          'Datas da fatura informadas por você: quando o banco não manda o fechamento e o vencimento pelo Open Finance, o cartão da fatura pede os dois dias (por exemplo, fecha 25 e vence 5). Com eles, o Jano mostra a fatura do ciclo, quando fecha e quando vence, calcula o valor pelas compras do período e mostra à parte o total no cartão com as parcelas futuras.',
      },
      {
        tipo: 'correcao',
        texto:
          'Com os dias informados, o "pode gastar" e o plano de Projeções descontam só a fatura do ciclo, não o saldo inteiro do cartão. O nome do cartão aparece sem caixa alta.',
      },
      {
        tipo: 'correcao',
        texto:
          'O pagamento da fatura como vem no extrato do BB ("Pgto Cartao") passa a ser reconhecido: a fatura paga sai do aviso de vencimento e o dia de pagamento entra no plano. Na lista ele aparece como "Pagamento da fatura", e o detalhe explica por que fica fora dos gastos: as compras do cartão já contam uma a uma.',
      },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'novo',
        texto:
          'Apelidos: no detalhe da transação, "Dar um apelido" troca o nome do banco por um seu (por exemplo, "JIM DAVI" vira "Academia") em todas as transações com aquele trecho, as passadas e as que ainda vão chegar. Vale em todas as telas e na busca.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Retorno ao tocar: os botões que gravam ou buscam algo mostram que estão trabalhando ("Salvando…", "Apagando…", "Importando…", "Aplicando…") e não aceitam um segundo toque até terminar.',
      },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'novo',
        texto:
          'Período financeiro pelo salário: o Jano conta do dia em que o salário cai até a véspera do próximo (por exemplo, 5/out – 4/nov), e não mais do dia 1 ao 30. Se o salário adiantar por fim de semana ou feriado, o período começa no dia em que ele caiu. Vale para Início, Orçamento, Avaliações, Transações, Categorias e Projeções; Conta mostra qual salário foi reconhecido.',
      },
    ],
  },
  {
    version: '0.16.1',
    date: '2026-11-01',
    items: [
      {
        tipo: 'correcao',
        texto:
          'Virada do mês sem susto: no dia 1, antes de cair qualquer lançamento, o Início mostra o saldo, a fatura, as metas e as últimas transações do mês anterior, em vez de pedir para importar. Avaliações lê o mês que acabou de fechar, e Transações oferece "Ver outubro".',
      },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Orçamento mais direto: no topo, quanto ainda cabe nas metas até o fim do mês e quais pedem atenção; as metas vêm da que pede mais atenção à que pede menos. Para mudar o limite, levar a sobra ou remover, toque na meta.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Início na ordem do que pede decisão: avisos, fatura, metas, gráfico e últimas transações. Os avisos levam direto ao que falam ("Ver transação", "Ajustar meta"). Na fatura, maiores compras, próxima fatura e o que vem todo mês ficam em "Ver…", a um toque.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Categorias mostram o gasto do mês, a meta e quantas regras usam cada uma. Toque para editar; apagar fica dentro da edição.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Menos coisa que não ajuda a decidir: saem o gráfico de saldo projetado de longo prazo (os cenários "E se…" continuam), a nota do mês em Avaliações e o calendário de Recorrências, que repetia os próximos 30 dias de Projeções.',
      },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-11-01',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Nomes legíveis em todas as listas: "PIX - ENVIADO 10/10 08:30 ESCOLA PEQUENO PRINCIPE" vira "Escola Pequeno Principe", sem data, hora, código de loja nem tudo em maiúsculas. No celular, a linha diz se foi Pix ou débito; a descrição original continua no detalhe do lançamento.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Transações no celular numa lista só, com o dia fixo no topo ao rolar e o total do dia ao lado. Cabem mais lançamentos por tela.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Um aviso por assunto: meta, gasto acima do normal e compra fora do padrão da mesma categoria viram um aviso só, com os números juntos. O Início mostra no máximo três; Avaliações tem a lista completa.',
      },
    ],
  },
  {
    version: '0.14.1',
    date: '2026-11-01',
    items: [
      {
        tipo: 'correcao',
        texto:
          'A fatura do cartão não aparece mais como "vencida" depois de paga: o cartão mostra "Fatura anterior paga em" e passa para a fatura aberta, com quando fecha. O "pode gastar" deixa de descontar a fatura que já foi paga.',
      },
      {
        tipo: 'correcao',
        texto:
          'Metas seguem o ritmo do mês: quem gasta bem à frente do ritmo vê "Acima do ritmo" e quanto dá por dia para fechar na meta. Contas que vêm uma vez por mês (aluguel, escola, luz) mostram "Contas do mês pagas" ou quanto falta pagar, sem alerta de 100%.',
      },
      {
        tipo: 'correcao',
        texto:
          'Começo do mês sem alarme falso: a sobra prevista usa o seu gasto e a sua receita típicos até o meio do mês, em vez de multiplicar as primeiras compras pelo mês inteiro. Nos primeiros dias, Avaliações mostra como fechou o mês anterior e não dá nota ao atual.',
      },
      {
        tipo: 'correcao',
        texto:
          'Gasto fixo é um número só: Recorrências e Projeções usam a mesma regra. Posto e farmácia no cartão, que mudam de valor todo mês, vão para "Gastos frequentes" e não contam como conta fixa.',
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Objetivos de economia em Projeções: diga quanto quer juntar e até quando, usando o saldo da poupança ou um valor informado. O Jano mostra quanto guardar por mês, se cabe na sua sobra média e em que mês você chega lá no ritmo atual; com vários objetivos, se juntos passam da sobra.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Atualizar o app ficou mais rápido: a versão nova já é baixada assim que aparece o aviso, e o botão mostra "Atualizando…" na hora do toque. O aviso ganhou a principal novidade da versão e um "Depois" para dispensar.',
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Fatura do cartão no Início: situação (fecha ou vence em quantos dias), valor, vencimento e pagamento mínimo do banco, limite usado, para onde foi o dinheiro por categoria, as maiores compras, o que já entrou na próxima fatura (inclusive compras pendentes) e o que cai no cartão todo mês. "Ver compras do cartão" abre Transações filtrada no cartão.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Gastos variáveis que se repetem no cartão (delivery, cinema) deixam de contar como conta fixa na renda comprometida de Projeções.',
      },
      {
        tipo: 'correcao',
        texto:
          'Suas regras valem antes de tudo nas transações novas, inclusive quando o app achava que era transferência. E nada que já tem categoria é alterado: nem a sincronização nem a marcação automática de transferências mexem nela.',
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Projeções virou o plano do mês: quanto fica livre até o salário, o que entra e sai nos próximos 30 dias com o saldo previsto depois de cada um (salário, contas fixas, fatura do cartão), e quanto da renda dos próximos meses já está comprometido com contas fixas e parcelas.',
      },
      {
        tipo: 'melhoria',
        texto:
          'A projeção de 3 a 12 meses e os cenários "E se" continuam, em Longo prazo, abaixo do plano.',
      },
      {
        tipo: 'melhoria',
        texto:
          'No modo demonstração, um chip "Demonstração ×" no centro do cabeçalho substitui o aviso azul; tocar nele sai do modo.',
      },
      {
        tipo: 'correcao',
        texto:
          'Metas: gastar exatamente o limite aparece como "No limite da meta", em atenção, e não mais como "Passou -R$ 0,00". No último dia, a mensagem diz "último dia do mês" em vez de "restam 0 dias", e o marcador de ritmo fica dentro da barra.',
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-10-31',
    items: [
      {
        tipo: 'novo',
        texto:
          'Início com destaque para o saldo e quanto dá para gastar por dia até o próximo salário, já descontando a fatura do cartão e as contas fixas que vencem antes.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Gasto e receita do mês comparados com o mês anterior até o mesmo dia, com a tendência dos últimos meses.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Visual revisado: cartões com mais profundidade, números maiores, ícones de categoria coloridos e saídas sem vermelho (o vermelho fica para o que pede atenção).',
      },
      {
        tipo: 'novo',
        texto:
          'Modo demonstração: no login ou no menu do avatar, abre o app com dados fictícios, sem precisar do servidor. Dá para navegar e editar à vontade; tudo volta ao recarregar.',
      },
      {
        tipo: 'correcao',
        texto: 'O contorno de foco ao navegar pelo teclado voltou a aparecer.',
      },
    ],
  },
  {
    version: '0.10.9',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'A sincronização diária só lê e altera os últimos 45 dias, numa consulta só: meses anteriores ficam como estão e não gastam leituras do servidor.',
      },
    ],
  },
  {
    version: '0.10.8',
    date: '2026-10-31',
    items: [
      {
        tipo: 'correcao',
        texto:
          'O app gasta bem menos leituras do servidor e evita o erro "Quota exceeded": meses antigos ficam guardados no aparelho e só são buscados de novo quando algo neles muda; só o mês atual e o anterior vão sempre ao servidor. Entre telas, o que já foi lido é reaproveitado.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Se o limite diário do servidor acabar, o app mostra os últimos dados guardados no aparelho, com um aviso, em vez de ficar vazio.',
      },
    ],
  },
  {
    version: '0.10.7',
    date: '2026-10-31',
    items: [
      {
        tipo: 'melhoria',
        texto:
          'Avaliações: "Ver transação" num gasto fora do padrão ou numa assinatura nova abre Transações no mês certo, rola até o lançamento e faz ele piscar.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Maiores estabelecimentos com mais espaço para o nome: a colocação virou um selo sobre o ícone da categoria.',
      },
      {
        tipo: 'melhoria',
        texto:
          'PIX para a mesma pessoa conta como um só estabelecimento e aparece só com o nome dela, sem "PIX - ENVIADO 14/10 08:43".',
      },
    ],
  },
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
      {
        tipo: 'melhoria',
        texto:
          'Detalhe da transação mais compacto no celular: o Salvar fica sempre à vista no pé do painel, o título mostra só o nome (sem "COMPRA C/CARTAO 30/10 14:26") e "Dividir em categorias" virou um link ao lado de Categoria.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Categorias de receita aparecem em verde, e as do tipo do lançamento vêm primeiro.',
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
