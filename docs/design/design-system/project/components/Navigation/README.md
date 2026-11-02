A navegação leva às áreas do produto: barra inferior no celular e barra lateral no desktop, com os mesmos destinos.

- **Mobile (até 639px):** `j-nav j-nav--bottom` com cinco itens (Início, Transações, Orçamento, Projeções, Mais). Cada item tem ícone de 22px e rótulo de 12px sempre visível, alvo de pelo menos 44px. O item atual tem `aria-current="page"` e uma pílula `primary-soft` atrás do ícone, com texto em `primary-text`.
- **Tablet (640px a 1023px):** barra lateral só com ícones, rótulos em tooltip.
- **Desktop (1024px ou mais):** `j-nav j-nav--side` de 240px com o logo no topo e os itens Início, Transações, Orçamento, Avaliações, Projeções, Recorrências e Configurações. O item atual usa fundo `primary-soft` e texto `primary-text`. Itens de 44px de altura.
- No celular, Avaliações, Recorrências e Configurações ficam dentro de "Mais".
- O seletor de mês fica fixo no topo do conteúdo, não na navegação.
- Navegue com `<nav aria-label="Principal">` e links reais (`<a href>`), nunca `div` clicável.
- O consumidor fornece a lista de destinos, o destino atual e a atribuição dos ícones de contorno.
- **Topo fixo e título da tela:** no celular o topo (logo e avatar) fica preso no alto. O título de cada tela usa `jano-page-head` (título + botões da tela): gruda logo abaixo do topo e, ao rolar, vira barra compacta com fundo `surface` e borda inferior, sem mudar de altura. Subtítulo fica fora dele e rola com a página.
