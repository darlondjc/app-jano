O sheet apresenta uma edição ou um detalhe sem sair da tela: bottom sheet no celular, painel lateral no desktop, com o mesmo conteúdo.

- **Mobile:** `j-sheet` colado na base, cantos superiores em `radius-lg`, alça de 40 × 4px em `border-strong`, título em `title-card`, fundo `surface` e `shadow-sheet`. Atrás, o `overlay`. Botão primário de 48px na largura toda, com "Cancelar" ao lado.
- **Desktop:** `j-panel` de 300 a 420px à direita, borda esquerda em `border` e `shadow-sheet`, sem escurecer a página quando for um detalhe (seleção de transação). Escureça com `overlay` só em edições que exigem decisão.
- Use `role="dialog"` com `aria-label`, mova o foco para dentro ao abrir, devolva ao elemento de origem ao fechar e feche com Esc ou ao tocar no `overlay`.
- Casos do produto: filtros, criar/editar meta, detalhe de transação (dividir categoria, criar regra), controles de cenário nas projeções.
- O consumidor fornece o título, os campos e as ações. O sheet não tem rolagem própria até 70% da altura da tela; passando disso, o conteúdo rola dentro dele.
- **Ações sempre à vista:** os botões de ação ficam em `j-sheet__acoes`, preso ao pé do sheet (fundo `surface`, borda superior `border`, área segura do iPhone embaixo). Só os campos rolam; ninguém precisa rolar até o fim para salvar ou aplicar.
