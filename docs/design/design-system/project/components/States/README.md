Os estados de carregamento, vazio e confirmação mantêm a tela compreensível quando ainda não há dados ou quando algo acabou de acontecer.

- **Carregando:** esqueleto (`j-skel`, fundo `surface-2`, `radius-sm`) na forma exata do conteúdo, dentro de um `j-card` com `aria-busy="true"`. Sem animação.
- **Vazio:** `j-empty` centralizado, com o símbolo de meia-lua do Jano (metade cheia e metade tracejada) em `primary`, um título em `body` (600), uma frase em `text-2` que diz o que falta e um botão primário com a ação ("Importar extrato").
- **Toast:** `j-toast` com fundo `text` e texto `bg` (invertido), ícone de confirmação, uma frase curta no passado ("Categoria atualizada em 3 transações") e `shadow-popover`. Some em 5 segundos; ações desfazer ficam em texto na própria mensagem.
- Toda tela precisa prever também os estados de erro de sincronização, consentimento expirando e expirado (veja Banner) e offline.
- O consumidor fornece o texto, a ação e a forma do esqueleto.
