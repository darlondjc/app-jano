Jano é um app web responsivo (PWA) de finanças pessoais em português do Brasil: reúne as transações, acompanha metas de orçamento, avalia os gastos e projeta os próximos meses. O nome vem do deus romano das duas faces, que olha para trás e para a frente, guarda as portas e carrega a chave. O produto faz o mesmo: mostra o que já aconteceu e o que vem.

## Voz e conteúdo

- Escreva em português do Brasil, em minúsculas e frases curtas. Trate a pessoa por "você". Não use emoji, gírias nem exclamações.
- O tom é calmo e direto. Diga o fato e a ação possível, sem julgamento moral. Exemplos reais do produto: "Você está abaixo do ritmo. Bom mês até aqui." e "Mercado chegou a 92% da meta. Restam 4 dias."
- Capitalize só a primeira palavra de títulos e botões ("Importar extrato", "Criar meta"). O nome do produto é "Jano", com J maiúsculo no texto e "jano" minúsculo apenas no logo.
- Valores em reais no formato `R$ 1.234,56`, com ponto de milhar e vírgula decimal. Negativos com sinal de menos (`−R$ 48,90`), nunca só em vermelho. Datas por extenso quando houver espaço ("27 de outubro") e `27/10` em listas.
- Percentuais sem casas decimais ("92%"). Prazos em dias ("restam 4 dias").
- Um aviso sempre diz o que aconteceu, por que importa e o que fazer. Nunca culpe ("você gastou demais"); descreva ("Lazer ficou 24% acima da sua média").
- O produto só lê dados: nunca pede a senha do banco e nunca move dinheiro. Repita isso em telas de conexão.

## Fundamentos visuais

- **Cor.** Fundo da página em `bg`, cartões em `surface`, campos e trilhas em `surface-2`. Texto em `text`; apoio em `text-2`. A cor tem função: `primary` para a ação principal e o logo; `positive`, `warning`, `danger` e `info` só para estados. Nunca use cor como único sinal: junte ícone ou texto.
- **Metas.** Progresso até 79% em `positive`, de 80% a 99% em `warning` e a partir de 100% em `danger`. O ritmo ideal do dia aparece como um marcador de 2px em `text`.
- **Categorias.** Use `cat-1` a `cat-8` na ordem. Em gráficos, cada categoria leva rótulo ou ícone. Passou de oito: agrupe em "Outros" com `text-2`.
- **Tipografia.** Inter em todo o produto, pelo token de família `sans`. Valores monetários usam números tabulares (`font-variant-numeric: tabular-nums`). Saldo principal em `balance`, valores de KPI em `value`, títulos em `title-page` e `title-card`, corpo em `body` e `body-sm`, rótulos em `label`.
- **Espaçamento.** Grade de 4px, pelos tokens `space-1` a `space-8`. Margem lateral de `space-4` no celular e de `space-6` no desktop. Padding de cartão `space-5`.
- **Forma.** Campos e botões em `radius-sm`, cartões em `radius-md`, sheets e modais em `radius-lg`, chips e trilhas em `radius-pill`.
- **Bordas e sombras.** Cartões usam borda de 1px em `border` e nenhuma sombra. Só elementos flutuantes (menus, toasts, sheets) usam `shadow-popover` e `shadow-sheet`. Controles têm contorno em `border-strong`.
- **Foco.** Anel sólido de 2px em `focus`, com 2px de afastamento, em todo elemento interativo.
- **Movimento.** Transições de 150 a 250ms, curva suave, só em hover, abertura de sheet e troca de aba. Respeite `prefers-reduced-motion`. Sem animação decorativa.
- **Layout.** Mobile até 639px: uma coluna, navegação inferior, alvos de toque de 44px, filtros e edições em bottom sheet. Tablet de 640px a 1023px: duas colunas, barra lateral só com ícones. Desktop a partir de 1024px: barra lateral de 240px, grade de 12 colunas, conteúdo de no máximo 1280px, painel de detalhe à direita. O mobile não é o desktop encolhido: reorganize a tela para cada faixa.
- **Gráficos.** Saldo e projeção em linha: realizado sólido, projeção tracejada em `info` ou `primary` e faixa de incerteza em `projection-band`. Comparativos em barras agrupadas, distribuição em rosca ou treemap, tendência em sparkline. Eixos em reais abreviados (mil, mi), grade em `chart-grid`, tooltip no toque e no mouse e uma tabela de dados acessível sob cada gráfico.
- **Estados obrigatórios.** Toda tela prevê carregando (esqueleto), vazio, erro de sincronização, consentimento expirando, consentimento expirado e offline.
- **Acessibilidade.** Contraste mínimo AA em todos os temas (4,5:1 para texto, 3:1 para contornos e ícones). Tema escuro completo. Modo "ocultar valores" troca todo valor por `••••`. Cada gráfico e ícone sem texto tem nome acessível.

## Iconografia

Use ícones de contorno com traço de 1,75px, pontas arredondadas, grade de 24px e cor `currentColor` herdada do texto. A biblioteca recomendada é a Lucide (licença ISC). Não use emoji. Ícone isolado precisa de `aria-label`; ícone ao lado de texto é decorativo (`aria-hidden`). Ícones de categoria ficam dentro de um círculo ou quadrado em `radius-sm` com a cor da categoria no fundo suave e o ícone na cor cheia.

## Logo

O símbolo é uma chave de duas faces: anel no alto, haste e dentes espelhados dos dois lados, para um passado e um futuro. Use o logo horizontal (símbolo + "jano" em Inter 600, minúsculo, espaçamento −2%) como padrão, o vertical em telas de abertura e só o símbolo em favicon e avatar. O ícone do app é a chave em branco inclinada a 45° sobre `primary`. Mantenha respiro mínimo igual ao diâmetro do anel, 16px de tamanho mínimo para o símbolo e 80px de largura para o logo horizontal. Não estique, gire, recolorir, aplique sombra nem troque a fonte do nome. Arquivos em `assets/Logos`.
