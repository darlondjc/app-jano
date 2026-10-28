O banner avisa sobre o estado do sistema ou da conta, sem tirar a pessoa do que estava fazendo.

- Variantes: `j-banner--info` (`info-soft` + `info`), `--warn` (`warning-soft` + `warning-text`), `--danger` (`danger-soft` + `danger`) e `--good` (`positive-soft` + `positive`). Toda variante traz ícone e texto.
- A primeira frase em negrito diz o que aconteceu; a seguinte diz o efeito; o link ao final diz o que fazer ("Importar", "Renovar", "Tentar de novo").
- Casos fixos do produto: importação atrasada, consentimento expirando em 15 dias (atenção), consentimento expirado e falha de sincronização (erro), importação concluída (sucesso).
- Use `role="alert"` só para erros que exigem ação imediata; os demais usam `role="status"`.
- Fica fixo no topo do conteúdo, abaixo do cabeçalho, e some quando o problema é resolvido. Não empilhe mais de um: mostre o de maior severidade.
- O consumidor fornece a variante, o texto e a ação.
