O botão dispara uma ação: um por tela é primário, os demais são secundários ou fantasmas.

- Classes `j-btn` + variante: `j-btn--primary` (fundo `primary`, texto `on-primary`), `j-btn--secondary` (contorno `border-strong`), `j-btn--ghost` (texto `primary-text`, para ações discretas) e `j-btn--danger` (fundo `danger`, só para apagar ou desconectar).
- Altura de 40px no desktop e 48px no celular (`j-btn--lg`, aplicado automaticamente em telas de toque). Alvo de toque nunca abaixo de 44px.
- Rótulo em verbo no infinitivo, em `label`: "Importar extrato", "Criar meta". Sem ponto final.
- Texto de botão desabilitado fica a 45% de opacidade; explique o motivo em texto de apoio, não só no botão.
- O consumidor fornece o rótulo e o `type` (`button` ou `submit`). Ícone, quando houver, vai antes do texto, em `currentColor`, 20px.
- Não use dois botões primários na mesma área. Ação destrutiva sempre pede confirmação.
