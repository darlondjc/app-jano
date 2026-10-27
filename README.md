# Jano

Planejamento financeiro pessoal: importa extratos (OFX/CSV), organiza transações, acompanha metas de gasto, avalia o mês e projeta o futuro.

## Estrutura

| Pasta              | O que é                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `apps/web`         | Front-end Angular (SPA, zoneless, PWA mais adiante)                                                          |
| `apps/api`         | API NestJS                                                                                                   |
| `libs/ui`          | `@jano/ui`: componentes do design system + tokens                                                            |
| `libs/engine`      | `@jano/engine`: regras de orçamento, avaliação e projeção (funções puras de orçamento, avaliação e projeção) |
| `libs/contracts`   | `@jano/contracts`: schemas Zod compartilhados                                                                |
| `libs/data-access` | `@jano/data-access`: cliente HTTP e stores do front                                                          |
| `tools/`           | Scripts (ex.: `build-tokens.mjs`)                                                                            |

Dinheiro sempre em **centavos inteiros**. Regras de dependência entre pastas são checadas pelo lint (tags do Nx).

## Comandos

```bash
npm install
npx nx serve web                      # front em http://localhost:4200
npx nx run-many -t lint test build    # tudo
npm run tokens                        # regenera CSS/TS a partir de libs/ui/tokens/tokens.json
```

O plano técnico completo (arquitetura, modelo de dados, fases) está no documento "Jano — Plano técnico de implementação (Angular)".

## Arquitetura (sem servidor próprio)

- **Hospedagem:** GitHub Pages (workflow `deploy.yml`, base href `/app-jano/`).
- **Login:** Firebase Authentication com Google.
- **Dados:** Cloud Firestore, tudo sob `users/{uid}`. `firestore.rules` só libera quem tem e-mail em `allowlist/{email}`.
- **Importação e cálculos:** rodam no navegador (parser OFX/CSV e `@jano/engine`).

## Configurar o Firebase (uma vez)

1. Crie um projeto em console.firebase.google.com (plano Spark, grátis).
2. Authentication → Método de login → ative **Google**. Em Configurações → Domínios autorizados, adicione `darlondjc.github.io`.
3. Firestore Database → crie o banco (modo produção). Em **Regras**, cole o conteúdo de `firestore.rules`.
4. Crie a coleção `allowlist` com um documento cujo ID é o seu e-mail (ex.: `voce@gmail.com`).
5. Projeto → Seus apps → app Web: copie a configuração para `apps/web/src/environments/firebase.ts`.
6. No GitHub: Settings → Pages → Source: **GitHub Actions**.
