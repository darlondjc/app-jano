# Design aprovado (cópia do Claude Design)

Cópia local dos artefatos do Claude Design que definem o Jano. Antes de implementar tela, componente, ícone ou texto, confira aqui o que já foi decidido. Os arquivos são cópias: a fonte de verdade continua no Claude Design, e esta pasta deve ser atualizada quando algo mudar lá.

Baixado em 27/10/2026.

| Pasta ou arquivo | O que tem | Original |
| --- | --- | --- |
| `definicao-e-design-system.md` | Visão do produto, módulos, telas, regras de projeção e avaliação, decisões de identidade (seção 10) | [Definição e Design System](https://claude.ai/artifact/M8eryp41QBwoXHVd4BNCTF) |
| `plano-tecnico.md` | Plano técnico em Angular. A seção 13 (sem servidor, Firebase) substitui o que conflitar nas anteriores | [Plano técnico](https://claude.ai/artifact/4ANzkj89MU8Awf2Txb4Q8q) |
| `design-system/project/` | README do DS (voz, cor, layout, logo), `tokens.json`, `components/bundle.css`, README e preview de cada componente | [Jano design system](https://claude.ai/artifact/V3bnxbzvWyQMKa9UdsFbq4) |
| `design-system/project/assets/Logos/` | SVGs oficiais: símbolo verde, branco, verde-claro e `jano-icone-app.svg` (chave a 45°) | idem |
| `telas-do-app/project/` | Protótipos de todas as telas, mobile e desktop, claro e escuro. `canvas.json` lista o título de cada artboard; `jano.css` tem os estilos usados | [Telas do app](https://claude.ai/artifact/Wm2dYVtKi16tYGz5zG5toQ) |
| `conceitos-de-logo/project/` | Rodadas de logo, guia de uso do logo escolhido (`Guia.dc.html`) e opções de ícone (`Icone.dc.html`, aprovada a B) | [Conceitos de logo](https://claude.ai/artifact/Lk8ZTD9oVEuqqKWM38Xrkh) |
| `direcoes-de-identidade/project/` | As três direções visuais. Aprovada a A, "Equilíbrio" (`Main.dc.html`) | [Direções de identidade](https://claude.ai/artifact/7L9GgUpXVZyBbsgVxQdoL6) |
| `revisao-2026-10-31.md` | Revisão do design system aprovada em 31/10: superfície da marca, elevação, números, contexto nos indicadores, cores suaves de categoria, foco corrigido. Vale sobre o que conflitar | [Revisão do Jano](https://claude.ai/artifact/E2cLgq5hgWaapvC8pvfNnV) |

Os `.dc.html` dependem do runtime do Claude Design (`support.js`) e não abrem sozinhos no navegador. Leia como HTML: a marcação e os estilos inline mostram layout, textos e valores.
