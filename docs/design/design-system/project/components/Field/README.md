O campo recebe um dado do usuário: texto, valor em reais, data, mês ou categoria com busca.

- Estrutura: `j-field` com rótulo (`label`) acima, controle `j-input` de 44px com contorno `border-strong` e texto de apoio ou erro abaixo.
- Valor monetário: prefixo `R$` em `text-2`, teclado numérico (`inputmode="decimal"`), números tabulares e vírgula decimal. Aceite `900`, `900,5` e `900,50`.
- Foco: contorno e anel de 1px em `primary`, além do anel de foco global.
- Erro: contorno em `danger` e mensagem em `danger`, sempre em texto ("Informe um valor maior que zero"). Nunca só com cor.
- Todo campo tem um `label` visível; placeholder não substitui rótulo.
- O consumidor fornece o rótulo, o valor, a validação e a mensagem. Para sugestões automáticas (como a média de 3 meses), use o texto de apoio.
