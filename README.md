# Jano

Planejamento financeiro pessoal: importa extratos (OFX/CSV), organiza transações, acompanha metas de gasto, avalia o mês e projeta o futuro.

## Estrutura

| Pasta              | O que é                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `apps/web`         | Front-end Angular (SPA, zoneless, PWA mais adiante)                                               |
| `apps/api`         | API NestJS                                                                                        |
| `libs/ui`          | `@jano/ui`: componentes do design system + tokens                                                 |
| `libs/engine`      | `@jano/engine`: regras de orçamento, avaliação e projeção (funções puras, usadas por API e front) |
| `libs/contracts`   | `@jano/contracts`: schemas Zod compartilhados                                                     |
| `libs/data-access` | `@jano/data-access`: cliente HTTP e stores do front                                               |
| `tools/`           | Scripts (ex.: `build-tokens.mjs`)                                                                 |

Dinheiro sempre em **centavos inteiros**. Regras de dependência entre pastas são checadas pelo lint (tags do Nx).

## Comandos

```bash
npm install
npx nx serve web                      # front em http://localhost:4200
npx nx serve api                      # API
npx nx run-many -t lint test build    # tudo
npm run tokens                        # regenera CSS/TS a partir de libs/ui/tokens/tokens.json
```

O plano técnico completo (arquitetura, modelo de dados, fases) está no documento "Jano — Plano técnico de implementação (Angular)".
