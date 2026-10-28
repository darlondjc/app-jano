O cartão de KPI mostra um número importante com sua variação, para responder "como está meu mês?" de relance.

- Estrutura em `j-card j-kpi`: rótulo em `body-sm` na cor `text-2`, valor em `value` (ou `balance` para o saldo do Início) com números tabulares, e uma linha de variação e contexto.
- Centavos ficam menores e em `text-2` (`j-kpi__cents`), para que o valor em reais domine.
- Variação em `j-delta`: `--good` (`positive-soft` + `positive`) quando é favorável, `--bad` (`danger-soft` + `danger`) quando não é, `--neutral` para metadados. Sempre com seta e texto ("8% menor que setembro"). "Favorável" depende do tipo: gasto menor é bom; receita menor não é.
- Não coloque mais de um valor grande por cartão. Compare sempre com um período claro (mês anterior ou média de 3 meses).
- O consumidor fornece o rótulo, o valor já formatado em `R$ 1.234,56`, a variação e o texto de contexto. No modo "ocultar valores", troque o valor por `R$ ••••`.
