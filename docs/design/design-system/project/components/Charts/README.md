Os gráficos do Jano mostram o saldo, a projeção, os comparativos mensais e a distribuição dos gastos; cada um responde a uma pergunta e nunca depende só de cor.

- **Projeção de saldo (linha).** Realizado em linha sólida `primary`; projeção tracejada em `info` (`stroke-dasharray` 6 5); faixa de incerteza em `projection-band`, do cenário otimista ao pessimista. Uma linha vertical pontilhada marca "hoje". Mostre o horizonte (3, 6 ou 12 meses) e um link "como calculamos".
- **Comparativo mensal (barras).** Meses fechados em `primary-soft`, mês atual em `primary`, meta como linha tracejada em `text` com rótulo ("Meta R$ 4.200"). Para duas ou mais categorias, use barras lado a lado, nunca empilhadas, salvo se a soma for um todo.
- **Distribuição (rosca ou treemap).** Use `cat-1` a `cat-8` na ordem e agrupe o resto em "Outros" com `text-2`. A legenda sempre mostra nome e percentual; o gráfico sozinho não basta.
- **Tendência (sparkline).** Linha de 2px em `primary` com ponto final; ao lado, a variação em `j-delta` com seta e texto.
- Grade e eixos em `chart-grid`, rótulos em `caption` na cor `text-2`, valores em reais abreviados ("R$ 5 mil", "R$ 1,2 mi").
- Interação: tooltip no toque e no mouse com o valor exato e a data; nunca só no hover.
- Cada gráfico tem `role="img"` com `aria-label` que resume a leitura, e uma tabela de dados acessível logo abaixo (pode ficar recolhida).
- Cores de categoria que precisam ser distinguidas aparecem também por rótulo ou posição. Para daltônicos, a diferença de claridade entre as cores de `cat-*` já ajuda, mas não substitui o rótulo.
- O consumidor fornece a série de dados em centavos, os rótulos dos eixos, a faixa de incerteza (valores baixo e alto por período) e o texto do `aria-label`.
