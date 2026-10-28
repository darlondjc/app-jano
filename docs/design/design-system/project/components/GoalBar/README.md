A barra de meta mostra quanto de um limite mensal já foi gasto e se o ritmo está dentro do esperado para o dia.

- Estrutura em `j-goal`: nome da categoria e percentual no topo, trilha `surface-2` de 12px em `radius-pill`, marcador de ritmo ideal (2px em `text`) e uma linha com "gasto de limite" e o ritmo.
- Estado pela cor e pelo texto: `j-goal--ok` até 79% (`positive`), `j-goal--warn` de 80% a 99% (`warning`, texto em `warning-text`) e `j-goal--over` a partir de 100% (`danger`). Cada estado traz ícone e frase ("No ritmo. Sobram R$ 120,00.", "Atenção: restam 4 dias e R$ 72,00.", "Passou R$ 84,00 da meta.").
- Preencha a barra até no máximo 100% da trilha e mostre o percentual real (124%).
- Use `role="progressbar"` com `aria-valuenow`, `aria-valuemin`, `aria-valuemax` e um nome acessível.
- O marcador de ritmo = dias passados ÷ dias do mês. Ele aparece em todas as barras do mês corrente e some em meses encerrados.
- O consumidor fornece nome, gasto, limite, percentual, ritmo e a frase de estado.
