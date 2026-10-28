A linha de transação mostra uma movimentação da conta: ícone da categoria, estabelecimento, conta e valor.

- Estrutura em `j-tx`: ícone de 40px em `radius-sm` com fundo `surface-2` e traço na cor da categoria (`cat-*`); nome em `label`; categoria e conta em `caption` na cor `text-2`; valor à direita com números tabulares.
- Saídas aparecem com sinal de menos (`−R$ 48,90`) na cor `text`. Entradas aparecem com `+` e na cor `positive` (`j-tx__amount--in`). Não pinte saídas de vermelho: o vermelho é reservado a metas estouradas e erros.
- Transferências entre contas próprias não contam como gasto nem como receita: mostre-as com ícone neutro em `text-2` e a nota "Não entra nos gastos".
- Agrupe por dia com `j-day` (texto em `caption`, maiúsculas, `text-2`): "HOJE · 27 DE OUTUBRO".
- No celular, deslizar a linha revela "Categorizar"; no desktop, a categoria é editável na própria linha e a seleção abre o painel de detalhe. Alvo de toque mínimo de 56px de altura no celular.
- O consumidor fornece estabelecimento, categoria, conta, data e valor em centavos já formatado. Sem categoria: ícone em `text-2` e a nota "Sem categoria" com ação "Categorizar".
