<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# Design aprovado

Antes de criar ou mudar tela, componente, ícone, logo ou texto de interface, consulte `docs/design/` (comece pelo `README.md` de lá). É a cópia local dos protótipos, do design system e dos documentos aprovados no Claude Design. Se algo não estiver lá, busque o artefato no Claude Design e baixe para essa pasta.

## Estados de carregamento

Toda tela ou componente que busca dados mostra **skeleton** enquanto carrega, nunca texto como "Carregando...". Use os componentes de `@jano/ui` (`JanoSkeletonGroup`, `JanoSkeleton`, `JanoSkeletonKpi`, `JanoSkeletonCard`, `JanoSkeletonRows`, `JanoSkeletonGoals`): o esqueleto tem a forma do conteúdo real, fica dentro de um `jano-skeleton-group` (`aria-busy` e texto para leitores de tela) e não tem animação. Carregamentos de dados também passam por `Progresso.acompanhar` (barra de progresso no topo).

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
