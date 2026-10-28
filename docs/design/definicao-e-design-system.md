# Sistema de Finanças Pessoais — Definição e Design System

Oct 27, 2026 · @Darlon

## 1. Visão do produto

**Nome: Jano.** Um app web responsivo (PWA) que reúne as transações do seu Banco do Brasil, organiza por categoria, acompanha metas de orçamento mensais e projeta como o saldo vai ficar nos próximos meses.

**Para quem:** uso pessoal, uma pessoa, conta(s) do BB (corrente, cartão, poupança). Pode crescer depois para outros bancos.

**Problema:** o app do banco mostra extrato, mas não responde "estou gastando mais do que deveria?" nem "vou fechar o mês no azul?".

**Princípios de produto**

- Responder em 5 segundos: a home diz se você está no caminho certo no mês.
- Automático por padrão: importar, categorizar e detectar recorrências sem digitação.
- Mobile e desktop são o mesmo produto, com layouts pensados para cada tela, não um encolhido do outro.
- Somente leitura: o sistema nunca move dinheiro.

**Escopo do MVP**

1. Conexão com o BB e sincronização diária de transações.
2. Lista de transações com busca, filtros e categorização (automática + manual).
3. Orçamento mensal por categoria, com acompanhamento em tempo real.
4. Avaliação dos gastos: resumo do mês, comparativos e alertas.
5. Projeção de saldo e de gastos para os próximos 3 a 12 meses.

**Fora do MVP:** múltiplos usuários, outros bancos, investimentos, pagamentos, importação de notas fiscais.

## 2. Como conectar ao Banco do Brasil

**O caminho viável é o Open Finance Brasil, por meio de um agregador.** Pessoa física não tem API pública direta do BB para ler o próprio extrato; o Open Finance é o mecanismo regulado pelo Banco Central para isso. Você autoriza o compartilhamento dentro do app do BB e o agregador entrega os dados ao seu sistema.

| Opção | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| Agregador (ex.: Pluggy, Belvo) | Widget de conexão no seu app; API REST devolve contas, transações e cartões | Rápido, já cuida de consentimento e renovação | Custo por conexão; dados passam por terceiro |
| Participar direto do Open Finance | Credenciar-se como instituição receptora | Controle total | Inviável para projeto pessoal (certificações, regulação) |
| Importação OFX/CSV | Você baixa o extrato no internet banking e envia ao sistema | Zero custo, sem terceiros, funciona no dia 1 | Manual; sem sincronização automática |

**Recomendação:** construir uma camada `BankConnector` com duas implementações: agregador (principal) e importação OFX/CSV (fallback e para histórico antigo). O resto do sistema só enxerga transações normalizadas.

**Decisão (27/10/2026): o MVP começa só com importação OFX/CSV.** O agregador entra depois, como outra implementação do `BankConnector`, sem mexer em transações, orçamento, avaliações ou projeções. A sincronização diária e o aviso de consentimento viram recursos de uma fase posterior; no MVP, o sistema lembra você de importar um novo extrato.

**Pontos de atenção**

- O consentimento do Open Finance expira (em geral até 12 meses, valor aproximado; confirmar com o agregador) e precisa de fluxo de renovação visível no app.
- O histórico retornado varia por banco e por tipo de dado; confirmar quantos meses o BB entrega.
- Transações de cartão podem chegar como fatura e como lançamentos; é preciso evitar contagem dupla.
- Antes de contratar, validar no plano gratuito/sandbox do agregador se há cobertura do BB para pessoa física e o limite de uso para conta própria.

## 3. Módulos e funcionalidades

| Módulo | O que faz | Detalhes que importam |
| --- | --- | --- |
| Conexão | Conectar, reconectar, status da sincronização | Selo "atualizado há X horas"; aviso 15 dias antes do consentimento expirar |
| Transações | Lista unificada, busca, filtros por conta, categoria, período e valor | Edição em lote; dividir uma transação em várias categorias; marcar como transferência interna para não somar em gastos |
| Categorias e regras | Categorização automática por estabelecimento | Regras do tipo "descrição contém X → categoria Y"; o sistema aprende com suas correções |
| Orçamento | Meta mensal por categoria e meta total | Barra de progresso, ritmo ideal do dia, sobra projetada, rollover opcional da sobra |
| Recorrências | Detecta assinaturas e contas fixas | Alimenta a projeção; lista "próximas cobranças" |
| Avaliações | Leitura do mês em linguagem simples | Comparativo com meses anteriores, maiores variações, categorias fora do padrão, gastos incomuns |
| Projeções | Saldo e gastos futuros | Cenário base + "e se" (cortar X%, nova despesa, renda extra); faixa otimista/pessimista |
| Alertas | Avisos no app e por e-mail | 80% e 100% da meta, ritmo acima do ideal, cobrança nova ou maior que o normal |
| Configurações | Contas, categorias, privacidade, exportação | Modo ocultar valores; exportar CSV; apagar todos os dados |

## 4. Telas e navegação

**Navegação.** Mobile: barra inferior com 5 itens (Início, Transações, Orçamento, Projeções, Mais) e botão flutuante para adicionar/editar. Desktop: barra lateral recolhível com os mesmos itens + Avaliações, Recorrências e Configurações, e painel de detalhe à direita.

| Tela | Objetivo | Mobile | Desktop |
| --- | --- | --- | --- |
| Conectar BB | Onboarding e consentimento | Passo a passo em tela cheia | Cartão central com explicação à direita |
| Início | "Como está meu mês?" | Saldo, ritmo vs. meta, 3 alertas, gráfico de 30 dias, últimas transações | Grade de 12 colunas: KPIs no topo, gráfico grande, orçamento e alertas ao lado |
| Transações | Encontrar e categorizar | Lista agrupada por dia, filtros em bottom sheet, deslizar para categorizar | Tabela densa com filtros fixos e painel de detalhe lateral |
| Orçamento | Acompanhar metas | Cartões por categoria com barra de progresso | Tabela/cartões com sparkline e edição inline |
| Criar/editar meta | Definir limite | Bottom sheet | Modal ou painel lateral |
| Avaliações | Entender os gastos | Feed de insights em cartões | Duas colunas: insights + gráficos comparativos |
| Projeções | Ver o futuro | Gráfico de linha com faixa + controles de cenário em sheet | Gráfico grande + painel de cenários fixo |
| Recorrências | Assinaturas e contas fixas | Lista com próxima data | Tabela com calendário |
| Configurações | Contas, privacidade, dados | Lista de seções | Abas verticais |

**Fluxos principais**

1. Primeiro acesso: criar conta → conectar BB → importar histórico → revisar categorias sugeridas → definir primeiras metas.
2. Uso diário (menos de 30 segundos): abrir Início → ver ritmo do mês → tocar num alerta → ajustar categoria ou meta.
3. Revisão mensal: Avaliações → comparar com mês anterior → ajustar metas do próximo mês com base na sugestão do sistema.

**Estados obrigatórios em toda tela:** carregando (skeleton), vazio, erro de sincronização, consentimento expirado, offline.

## 5. Modelo de dados, projeção e avaliação

**Entidades principais**

| Entidade | Campos-chave |
| --- | --- |
| Connection | provedor, status, consentimento\_expira\_em, última\_sync |
| Account | connection\_id, tipo (corrente, cartão, poupança), nome, saldo, moeda |
| Transaction | account\_id, data, valor (centavos, com sinal), descrição\_original, estabelecimento, category\_id, é\_transferência, recorrência\_id, id\_externo (único) |
| Category | nome, cor, ícone, pai, tipo (despesa, receita, transferência) |
| Rule | padrão, category\_id, prioridade |
| Budget | category\_id (ou total), mês, limite, rollover |
| Recurrence | estabelecimento, valor\_típico, periodicidade, próxima\_data |
| Insight | tipo, mês, mensagem, severidade, dados |
| Scenario | nome, ajustes (por categoria ou renda), criado\_em |

**Regras de projeção (v1, transparentes e explicáveis)**

1. Receita futura = recorrências de entrada + média móvel dos últimos 3 meses para o restante.
2. Despesas fixas = recorrências detectadas, na data prevista.
3. Despesas variáveis = média ponderada dos últimos 3 a 6 meses por categoria, com mais peso nos meses recentes, distribuída pelos dias do mês.
4. Faixa de incerteza = desvio dos meses anteriores (otimista e pessimista).
5. Cenários aplicam ajustes sobre a base (ex.: Lazer −20%, nova parcela de R$ 400 a partir de janeiro).

Toda projeção mostra "como calculamos" em um clique. Modelos estatísticos mais sofisticados ficam para depois, quando houver histórico suficiente.

**Regras de avaliação**

- Ritmo: gasto acumulado ÷ meta, comparado ao ideal para o dia do mês.
- Variação: categoria acima de 20% (ajustável) da sua média de 3 meses vira insight.
- Gasto incomum: transação acima de 2,5 desvios da média da categoria.
- Recorrência nova ou reajustada: valor diferente do histórico do estabelecimento.
- Nota do mês (opcional): índice simples de 0 a 100 combinando metas cumpridas, poupança e ritmo. Sem julgamento moral, só orientação.

## 6. Arquitetura, segurança e LGPD

**Stack sugerida (simples de manter por uma pessoa)**

- Front-end: Next.js + TypeScript + Tailwind, PWA instalável (funciona como app no celular).
- Back-end: rotas de API do próprio Next.js ou Node/Fastify; PostgreSQL; fila de jobs para sincronização diária e geração de insights.
- Gráficos: Recharts ou visx. Autenticação: Auth.js ou provedor gerenciado, com 2FA.
- Hospedagem: Vercel/Fly/Railway + Postgres gerenciado com backup.

**Fluxo de dados**

1. Widget do agregador abre a tela de consentimento do BB.
2. O agregador retorna um identificador de conexão; o sistema guarda só esse identificador e metadados.
3. Job diário busca transações novas, normaliza e grava com `id_externo` único (evita duplicatas).
4. Motor de categorização aplica regras, depois gera recorrências e insights.
5. A interface lê apenas do seu próprio banco, nunca direto do banco ou do agregador.

**Segurança**

- Você nunca digita nem guarda senha do BB: o acesso é por consentimento.
- Tokens do agregador criptografados em repouso; segredos em variável de ambiente, nunca no front-end.
- HTTPS obrigatório, cookies HttpOnly, 2FA, log de acessos, sessão curta no celular.
- Modo "ocultar valores" e bloqueio por biometria no PWA (quando suportado).

**LGPD (dados financeiros são sensíveis na prática)**

- Coletar o mínimo necessário e informar a finalidade.
- Botão de exportar e de apagar todos os dados.
- Revogar o consentimento no app do BB deve desligar a sincronização e avisar no sistema.
- Se for aberto a outras pessoas no futuro, será preciso política de privacidade, termos e avaliação jurídica.

## 7. Design system "Jano"

**Direção visual:** calma, clara e confiável. Muito espaço em branco, números grandes e legíveis, cor usada só para dar significado (progresso, alerta, categoria). Sem usar logo, cores ou elementos da marca do Banco do Brasil, para não parecer um produto oficial do banco.

### Cores (tokens)

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| bg | #F7F8FA | #0C1117 | Fundo da página |
| surface | #FFFFFF | #151C24 | Cartões, painéis |
| surface-2 | #EEF1F5 | #1C252F | Campos, áreas secundárias |
| border | #E1E5EB | #2A3542 | Divisores, contornos |
| text | #0F1720 | #EAEFF5 | Texto principal |
| text-2 | #5B6675 | #9AA7B5 | Texto secundário |
| primary | #0E7C6B | #3CC4AB | Ações principais, foco, links |
| primary-soft | #DDF3EE | #123A34 | Fundos de destaque |
| positive | #1B8A4B | #4CC27D | Receita, meta cumprida |
| warning | #B7791F | #E0A84A | Perto do limite (80%+) |
| danger | #C23B3B | #F07272 | Estourou a meta, erro |
| info | #2F6FDE | #6C9CF5 | Dicas e projeções |

Categorias (série de 8, distinguíveis também por ícone e rótulo): #0E7C6B, #2F6FDE, #B7791F, #8E4DC4, #C23B3B, #1F9CB8, #6B7A2A, #D0558A. Progresso de meta: verde até 79%, âmbar de 80% a 99%, vermelho acima de 100%. Cor nunca é o único sinal: sempre acompanha ícone ou texto.

### Tipografia

- Família: Inter (UI e números), com números tabulares ativados em todo valor monetário.
- Escala: 12 (legenda) · 14 (corpo pequeno, tabelas) · 16 (corpo) · 20 (título de cartão) · 24 (título de página) · 32 (valor de destaque) · 44 (saldo principal).
- Pesos: 400 corpo, 500 rótulos, 600 títulos e valores.
- Moeda no padrão pt-BR: R$ 1.234,56. Negativos com sinal de menos e centavos menores que o valor inteiro nos números de destaque.

### Espaçamento, forma e movimento

- Grade de 4 px; espaçamentos 4, 8, 12, 16, 24, 32, 48.
- Raios: 8 (campos, botões), 12 (cartões), 16 (sheets), 999 (chips).
- Sombras só em elementos flutuantes; cartões usam borda de 1 px.
- Movimento de 150 a 250 ms, curva suave; respeitar "reduzir movimento".

### Responsividade

| Faixa | Largura | Layout |
| --- | --- | --- |
| Mobile | até 639 px | 1 coluna, barra inferior, sheets, margens de 16 px, alvos de toque de 44 px |
| Tablet | 640 a 1023 px | 2 colunas, barra lateral só com ícones |
| Desktop | 1024 px ou mais | Barra lateral fixa de 240 px, grade de 12 colunas, conteúdo máximo de 1280 px, painel de detalhe |

### Componentes

| Componente | Variações e regras |
| --- | --- |
| Botão | Primário, secundário, fantasma, destrutivo; 40 px desktop e 48 px mobile |
| Campo e seletor | Texto, valor monetário, data, mês, categoria com busca; erro inline |
| Cartão de KPI | Rótulo, valor, variação vs. período anterior com seta e cor |
| Barra de progresso de meta | Rótulo, gasto/limite, marcador do ritmo ideal, estados verde/âmbar/vermelho |
| Linha de transação | Ícone da categoria, estabelecimento, conta, valor à direita; deslizar no mobile |
| Tabela | Densa no desktop, vira lista de cartões no mobile; cabeçalho fixo |
| Chip de filtro e tag de categoria | Selecionável, removível |
| Bottom sheet / modal / painel lateral | Sheet no mobile, modal ou painel no desktop, mesmo conteúdo |
| Cartão de insight | Ícone, frase curta, dado de apoio, ação ("ajustar meta") |
| Gráficos | Linha (saldo e projeção com faixa), barras (comparativo mensal), rosca/treemap (distribuição), sparkline |
| Feedback | Toast, banner de consentimento expirando, skeleton, estado vazio com ilustração simples |
| Navegação | Barra inferior (mobile), barra lateral (desktop), seletor de mês fixo no topo |

**Regras de gráficos:** projeção sempre em linha tracejada com faixa de incerteza; eixo em R$ com abreviação (mil, mi); tooltip no toque e no mouse; tabela de dados acessível sob cada gráfico.

**Acessibilidade:** contraste mínimo AA (4,5:1 para texto), foco visível, navegação por teclado, rótulos para leitor de tela, modo escuro, modo "ocultar valores".

## 8. Prompts para o Claude Design

Use na ordem. Os prompts 0a e 0b definem identidade e logo, o Prompt 1 cria o design system; os demais pedem as telas usando esse sistema, sempre com artboards de mobile (390 px) e desktop (1440 px) lado a lado. Dados de exemplo em português, valores em R$.

### Prompt 0a — Direções de identidade visual

```text
Antes de criar o design system, proponha 3 direções de identidade visual para um app de finanças pessoais em português do Brasil chamado Jano (o nome já está definido): logotipo simples, paleta, tipografia e tom de voz. Mostre cada direção aplicada a um cartão de KPI e a uma barra de meta. Depois eu escolho uma e você segue com o design system completo.
```

Se a direção escolhida for diferente da paleta e da tipografia do Prompt 1, cole a direção escolhida no lugar dos tokens do Prompt 1.

### Prompt 0b — Ideia do logo

```text
Crie conceitos de logo para o Jano, um app de finanças pessoais em português do Brasil que mostra o histórico de gastos e projeta o futuro. O nome vem de Jano, o deus romano das duas faces, que olha ao mesmo tempo para trás e para a frente, guardião das portas e das passagens, que também dá nome ao mês de janeiro (o começo do ano). Quero explorar esse significado: olhar para o passado e para o futuro, passagem, porta, começo, equilíbrio.

Entregue 6 conceitos diferentes, cada um com uma frase explicando a ideia. Explore caminhos como: duas formas espelhadas que sugerem duas direções; uma porta ou arco que também lembra um J; o J com uma seta para cada lado; duas metades de um círculo, uma sólida (histórico) e uma tracejada (projeção); formas geométricas abstratas, sem desenhar rostos literais e sem símbolos religiosos. Evite clichês de finanças (cifrão, moeda, gráfico de barras subindo, cofrinho) e não use logo, cores ou elementos do Banco do Brasil.

Para cada conceito mostre: símbolo sozinho, versão horizontal com o nome "Jano", versão de uma cor só, versão em fundo escuro, ícone de app quadrado de 512 px e teste de legibilidade em 16 px (favicon). Em seguida eu escolho um e você refina: ajuste de proporções, espaço de respiro, tamanho mínimo e uso correto e incorreto.
```

### Prompt 1 — Design system

```text
Crie um Design System chamado "Jano" para um app web responsivo (PWA) de finanças pessoais em português do Brasil: conecta ao banco via Open Finance, lista transações, acompanha metas de orçamento, avalia gastos e projeta o futuro. Direção visual: calma, clara, confiável, muito espaço em branco, números grandes e legíveis, cor só para dar significado. Não usar logo, cores ou elementos da marca do Banco do Brasil. Use a direção de identidade visual escolhida no Prompt 0a e o logo escolhido no Prompt 0b (anexe a imagem ou descreva): se a direção escolhida tiver paleta e tipografia próprias, elas substituem os tokens abaixo, que valem apenas como ponto de partida. Inclua nos assets do design system o logo do Jano (símbolo e versão horizontal, em tema claro e escuro) e o ícone do app, e use o logo no cabeçalho e na navegação de todas as telas.

Tokens, tema claro e escuro:
- bg #F7F8FA / #0C1117; surface #FFFFFF / #151C24; surface-2 #EEF1F5 / #1C252F; border #E1E5EB / #2A3542; text #0F1720 / #EAEFF5; text-2 #5B6675 / #9AA7B5
- primary #0E7C6B / #3CC4AB; primary-soft #DDF3EE / #123A34
- positive #1B8A4B / #4CC27D; warning #B7791F / #E0A84A; danger #C23B3B / #F07272; info #2F6FDE / #6C9CF5
- Categorias (8): #0E7C6B, #2F6FDE, #B7791F, #8E4DC4, #C23B3B, #1F9CB8, #6B7A2A, #D0558A
- Tipografia Inter, números tabulares; escala 12/14/16/20/24/32/44; pesos 400/500/600
- Espaçamento base 4 px (4, 8, 12, 16, 24, 32, 48); raios 8/12/16/999; cartões com borda de 1 px, sombra só em elementos flutuantes
- Breakpoints: mobile até 639, tablet 640-1023, desktop 1024+; alvos de toque de 44 px

Componentes com preview vivo, estados e guidelines: botões (primário, secundário, fantasma, destrutivo), campos (texto, valor monetário em R$, data, mês, categoria com busca), cartão de KPI com variação, barra de progresso de meta (verde até 79%, âmbar 80-99%, vermelho 100%+, com marcador do ritmo ideal), linha de transação (ícone da categoria, estabelecimento, conta, valor), tabela densa que vira lista de cartões no mobile, chips de filtro, tag de categoria, bottom sheet / modal / painel lateral, cartão de insight com ação, toast, banner de consentimento expirando, skeleton, estado vazio, navegação (barra inferior no mobile com 5 itens, barra lateral de 240 px no desktop, seletor de mês), e estilos de gráfico (linha de saldo, projeção tracejada com faixa de incerteza, barras comparativas, rosca de distribuição, sparkline). Formato de moeda pt-BR: R$ 1.234,56. Acessibilidade AA, cor nunca como único sinal, modo "ocultar valores".
```

### Prompt 2 — Início

```text
Usando o design system Jano, crie a tela Início em dois artboards: mobile (390 px) e desktop (1440 px), tema claro. Pergunta que a tela responde em 5 segundos: "Como está meu mês?".
Conteúdo (dados de exemplo, outubro de 2026): saldo atual R$ 4.832,17; gasto no mês R$ 3.114,60 de meta total R$ 4.200,00 (74%, ritmo ideal para o dia 27 seria 87%, então "abaixo do ritmo" em verde); receitas do mês R$ 6.500,00; projeção de fechamento do mês: sobra de R$ 612,00. Três alertas: Mercado a 92% da meta, assinatura nova de R$ 39,90, Lazer 24% acima da média. Gráfico de gasto acumulado do mês contra o ritmo ideal. Quatro barras de progresso das maiores categorias. Últimas 6 transações. Selo "atualizado há 3 horas" e botão de sincronizar.
Mobile: uma coluna, barra inferior, números grandes no topo. Desktop: barra lateral, KPIs em linha no topo, gráfico grande à esquerda, orçamento e alertas à direita. Não é o mesmo layout encolhido: reorganize para cada tela.
```

### Prompt 3 — Transações

```text
Usando o design system Jano, crie a tela Transações em artboards mobile (390 px) e desktop (1440 px). Lista de 20 transações realistas de uma pessoa no Brasil (Pão de Açúcar, iFood, Uber, Netflix, Enel, Farmácia Pague Menos, salário, Pix recebido, transferência entre contas), agrupadas por dia, com categoria, conta e valor; transferências internas marcadas e fora do total de gastos.
Mobile: busca no topo, chips de filtro, filtros completos em bottom sheet, deslizar para categorizar, seleção múltipla com barra de ação. Desktop: tabela densa com filtros fixos à esquerda, ordenação, edição inline de categoria e painel de detalhe à direita (dividir em várias categorias, criar regra "sempre que contiver X → categoria Y"). Mostrar também: estado vazio de busca e estado de transação sem categoria sugerida.
```

### Prompt 4 — Orçamento e criação de meta

```text
Usando o design system Jano, crie a tela Orçamento (mobile 390 px e desktop 1440 px) e o fluxo de criar/editar meta (bottom sheet no mobile, painel lateral no desktop). Mês selecionável. Meta total R$ 4.200,00 e 9 categorias (Mercado R$ 900, Restaurantes R$ 500, Transporte R$ 400, Moradia R$ 1.200, Saúde R$ 300, Lazer R$ 350, Assinaturas R$ 150, Educação R$ 200, Outros R$ 200) com gasto atual, barra de progresso com marcador do ritmo ideal, sobra projetada e sparkline dos últimos 6 meses. Mostrar os três estados de cor (verde, âmbar, vermelho). No fluxo de meta: categoria, limite mensal, sugestão automática baseada na média de 3 meses, opção de levar a sobra para o mês seguinte, aplicar a todos os meses ou só a este.
```

### Prompt 5 — Avaliações

```text
Usando o design system Jano, crie a tela Avaliações (mobile 390 px e desktop 1440 px): a leitura do mês em linguagem simples. Topo: resumo em uma frase ("Você gastou 8% menos que em setembro, mas Lazer subiu 24%"), nota opcional do mês de 0 a 100 com explicação do cálculo. Depois: cartões de insight com ação (categorias fora do padrão, gasto incomum de R$ 480 em uma loja, recorrência reajustada, meta cumprida), comparativo mês a mês por categoria (barras agrupadas, últimos 6 meses), distribuição do gasto (rosca ou treemap) e os 5 maiores estabelecimentos. Tom neutro e útil, sem julgamento moral. Desktop em duas colunas (insights à esquerda, gráficos à direita); mobile em feed de cartões.
```

### Prompt 6 — Projeções

```text
Usando o design system Jano, crie a tela Projeções (mobile 390 px e desktop 1440 px). Gráfico principal de saldo projetado para 6 meses: linha sólida para o realizado, tracejada para a projeção base e faixa de incerteza (otimista e pessimista). Seletor de horizonte (3, 6, 12 meses). Painel de cenários "e se": cortar Lazer em 20%, nova parcela de R$ 400 a partir de janeiro, renda extra de R$ 800 em dezembro; cada ajuste liga/desliga e atualiza o gráfico, com comparação "base vs. cenário" e diferença no saldo final. Lista das próximas cobranças recorrentes. Link "como calculamos" abrindo uma explicação curta. Mobile: gráfico no topo, cenários em bottom sheet. Desktop: gráfico grande com painel de cenários fixo à direita.
```

### Prompt 7 — Conexão com o banco e estados

```text
Usando o design system Jano, crie o fluxo de onboarding e conexão em artboards mobile (390 px) e desktop (1440 px): 1) boas-vindas explicando que o app só lê dados, nunca move dinheiro e nunca pede a senha do banco; 2) escolher o banco (Banco do Brasil) e entender o consentimento do Open Finance (o que será compartilhado, por quanto tempo, como revogar); 3) importando histórico com progresso; 4) revisar categorias sugeridas; 5) definir primeiras metas. Depois crie os estados do sistema: sincronizando, sincronização falhou, consentimento expirando em 15 dias (banner), consentimento expirado (tela de reconexão), offline, e importação alternativa por arquivo OFX/CSV. Em nenhuma tela usar logo ou cores do Banco do Brasil.
```

**Para o MVP com importação, use esta versão do Prompt 7:**

```text
Usando o design system Jano, crie o fluxo de onboarding e importação em artboards mobile (390 px) e desktop (1440 px): 1) boas-vindas explicando que o app só lê dados, nunca move dinheiro e nunca pede a senha do banco; 2) como importar: instruções curtas para baixar o extrato em OFX ou CSV no internet banking do banco, sem usar logo nem cores do Banco do Brasil; 3) enviar arquivo (arrastar e soltar no desktop, seletor de arquivo no mobile) com pré-visualização das primeiras transações, período detectado, contagem de novas e de duplicatas ignoradas; 4) revisar categorias sugeridas; 5) definir primeiras metas. Estados: arquivo em formato inválido, importação parcial com avisos, importação concluída, e lembrete na tela Início "última importação há 12 dias" com botão "Importar novo extrato". Incluir um cartão discreto "Sincronização automática: em breve".
```

**Depois dos protótipos:** peça ao Claude Design uma revisão de consistência (espaçamentos, estados, contraste, tema escuro) e a versão escura das telas 2 a 6.

## 9. Roadmap por fases

| Fase | Entrega | Critério de pronto |
| --- | --- | --- |
| 0. Validação | Testar agregador no sandbox e importação OFX/CSV; protótipos no Claude Design | Transações reais do BB aparecem normalizadas |
| 1. Base | Login com 2FA, modelo de dados, importação OFX/CSV, lista de transações, categorias | Histórico dos últimos 12 meses navegável |
| 2. Conexão | Agregador, sincronização diária, renovação de consentimento | Transações novas chegam sem ação manual |
| 3. Orçamento | Metas por categoria, ritmo, alertas | Meta acompanhada em tempo real, alerta em 80% e 100% |
| 4. Avaliações | Insights, comparativos, recorrências | Resumo mensal gerado sozinho |
| 5. Projeções | Projeção base, faixa, cenários "e se" | Projeção explicável a cada mês |
| 6. Polimento | PWA, modo escuro, acessibilidade, backup, exportar/apagar dados | Uso diário no celular sem atrito |

**Ajuste pela decisão de começar com importação:** a fase 2 (agregador e sincronização) vira opcional e pode ser feita depois da fase 5. As fases 3 a 5 funcionam inteiras com OFX/CSV; no mobile, importar um extrato por mês leva menos de um minuto.

**Perguntas em aberto**

- Quantas contas e cartões do BB entram no início?
- Aceita pagar por um agregador, ou começa só com OFX/CSV?
- Uso só seu ou pretende abrir para outras pessoas depois?

## 10. Identidade e protótipos (decisões tomadas)

- **Direção visual:** A, "Equilíbrio". Verde-azulado #0E7C6B, fonte Inter, tom calmo, claro e confiável.
- **Logo:** conceito 7, a chave de duas faces (símbolo da chave com anel, hastes e dentes dos dois lados).
- **Ícone do app:** opção B, chave branca inclinada a 45° sobre fundo verde.
- **Entrada de dados no MVP:** importação OFX/CSV. A sincronização automática aparece como "em breve".
- **Design system:** [Jano — design system](https://claude.ai/artifact/V3bnxbzvWyQMKa9UdsFbq4), com tokens claro e escuro, componentes, gráficos e arquivos de logo.
- **Protótipos:** [Jano — Telas do app](https://claude.ai/artifact/Wm2dYVtKi16tYGz5zG5toQ). Reúne Início, Transações, Orçamento e metas, Avaliações, Projeções, onboarding com importação, splash animada, login com Google e a versão escura das telas 2 a 6, em celular e desktop.
- **Pendências conhecidas:** dados de exemplo de Moradia diferem entre Transações e Orçamento; o botão do Google usa uma letra G provisória, a trocar pelo botão oficial na implementação.
