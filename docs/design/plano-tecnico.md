# Jano — Plano técnico de implementação (Angular)

Oct 27, 2026 · @Darlon

## 1. Premissas e escopo do MVP

O MVP é um app web responsivo (PWA) em Angular, de uso pessoal, que importa extratos OFX/CSV do Banco do Brasil e entrega as telas já prototipadas: Início, Transações, Orçamento, Avaliações, Projeções, onboarding, splash e login com Google.

- **Entra:** login com Google, importação OFX/CSV com pré-visualização e detecção de duplicatas, categorização por regras, metas por categoria, insights, nota do mês, projeção com cenários "e se", tema claro e escuro, exportar e apagar dados.
- **Fica de fora (depois):** sincronização automática via Open Finance (agregador), múltiplos usuários com convites, notificações push, importação de PDF.
- **Premissas:** valores guardados em centavos (inteiros), fuso America/Sao\_Paulo, idioma pt-BR, nenhuma credencial bancária jamais armazenada.
- **Referências de produto e design:** [definição do sistema](https://claude.ai/artifact/M8eryp41QBwoXHVd4BNCTF), [design system Jano](https://claude.ai/artifact/V3bnxbzvWyQMKa9UdsFbq4) e [protótipos das telas](https://claude.ai/artifact/Wm2dYVtKi16tYGz5zG5toQ).

## 2. Arquitetura geral

Três peças: um front Angular estático, uma API em TypeScript e um banco PostgreSQL. A única regra de negócio duplicada de propósito é o motor de orçamento e projeção, que vive em uma biblioteca compartilhada para o servidor calcular o oficial e o navegador recalcular os cenários "e se" na hora.

1. **Front (Angular, PWA):** servido como arquivos estáticos por CDN. Fala só com a API, por cookie de sessão.
2. **API (NestJS):** autenticação com Google, importação, categorização, orçamento, insights, projeções, exportar e apagar dados. Contrato descrito em OpenAPI; o cliente Angular é gerado a partir dele.
3. **Worker (BullMQ + Redis):** processa importações grandes e recalcula insights após cada importação, sem travar a API.
4. **PostgreSQL:** fonte única dos dados, sempre filtrados por `user_id`.
5. **Armazenamento de objetos:** guarda o arquivo original enviado por até 30 dias (para reprocessar) e some depois.
6. **Biblioteca `engine` (TypeScript puro):** funções de ritmo, sobra, insights e projeção, sem dependência de framework; usada pela API e pelo Angular.
7. **`BankConnector` (porta futura):** interface que hoje só tem a implementação `FileImportConnector`; o agregador Open Finance entra como outra implementação, sem mexer no resto.

## 3. Front-end em Angular

O front é uma SPA Angular moderna, sem SSR (o app fica atrás de login, então não há ganho de SEO). A prioridade é abrir rápido no celular e ficar fluido com milhares de transações.

### Base técnica

- **Angular atual (standalone, sem NgModules), signals e modo zoneless.** Fluxo de controle com `@if`, `@for`, `@defer`.
- **Rotas com carregamento sob demanda** (`loadComponent` / `loadChildren`): início, transações, orçamento, avaliações, projeções e onboarding são chunks separados.
- **Formulários reativos tipados** para meta, filtro, edição de transação e divisão em categorias.
- **Estado:** services com signals por feature; NgRx SignalStore só onde houver estado compartilhado complexo (filtros de transações, seleção múltipla, cenários de projeção).
- **HTTP:** cliente gerado do OpenAPI, interceptors para CSRF, erro padronizado e tentativa de novo em GET.
- **Localização:** `pt-BR` fixo (`registerLocaleData`), moeda sempre em centavos inteiros e formatada com `Intl`. Nunca usar `number` com decimais para dinheiro.
- **Gráficos:** ECharts via `ngx-echarts` carregado por `@defer` apenas nas telas que precisam; sparklines e barras de meta em SVG próprio (leves, sem biblioteca).
- **Listas longas:** `cdk-virtual-scroll-viewport` na lista de transações, agrupada por dia.
- **Overlays:** Angular CDK para bottom sheet (mobile), painel lateral (desktop), diálogos, foco preso e Esc para fechar.

### Estrutura do workspace (Nx)

| Pasta | Conteúdo |
| --- | --- |
| `apps/web` | Shell Angular: rotas, layout responsivo, PWA, tema |
| `apps/api` | NestJS |
| `libs/ui` (`jano-ui`) | Componentes do design system em Angular: Button, Chip, Field, KpiCard, GoalBar, InsightCard, TransactionRow, Banner, Sheet, Navigation, States, Charts |
| `libs/data-access` | Cliente OpenAPI gerado e stores |
| `libs/features/*` | `inicio`, `transacoes`, `orcamento`, `avaliacoes`, `projecoes`, `onboarding`, `auth` |
| `libs/engine` | Funções puras de ritmo, sobra, insights e projeção (compartilhada com a API) |
| `libs/contracts` | Tipos e schemas compartilhados (Zod) |

Regra de dependência imposta por lint do Nx: `features` podem usar `ui`, `data-access`, `engine`; `ui` não conhece nenhuma feature; nada importa de `apps`.

### Do design system para o código

1. `tokens.json` é a fonte única. Um script de build gera as variáveis CSS (`:root` e `[data-theme="dark"]`) e um arquivo de tokens TypeScript.
2. Cada componente do DS vira um componente standalone em `libs/ui`, com `ChangeDetectionStrategy.OnPush`, inputs por signal e uma história no Storybook (claro e escuro, estados vazio, carregando e erro).
3. As telas do protótipo são a referência visual; o dado de exemplo delas vira fixture para Storybook e testes.
4. Tema claro/escuro por atributo `data-theme`, respeitando `prefers-color-scheme` e com escolha manual lembrada.

### Responsivo

- **Mobile (< 768 px):** barra de navegação inferior, bottom sheets, uma coluna.
- **Desktop (≥ 1024 px):** navegação lateral, painel lateral no lugar do sheet, grades de 2 a 3 colunas.
- A mesma rota e o mesmo componente de feature; só o layout muda, via CSS e `BreakpointObserver` do CDK quando a estrutura muda (sheet vs. painel).

### Telas e rotas

| Rota | Tela do protótipo |
| --- | --- |
| `/entrar` | Splash animada e login com Google |
| `/boas-vindas`, `/importar` | Onboarding (5 passos) |
| `/` | Início |
| `/transacoes` | Lista, filtros, seleção múltipla, detalhe |
| `/orcamento` | Metas por categoria, criar/editar |
| `/avaliacoes` | Nota do mês, insights, maiores gastos |
| `/projecoes` | Projeção, faixa de incerteza, cenários |

Guards: `authGuard` (sessão válida) e `onboardingGuard` (sem transações, vai para importação).

## 4. Back-end e API

NestJS em TypeScript, para dividir tipos e validação com o front e usar a mesma biblioteca `engine`. A API é REST com JSON, versionada em `/v1` e documentada em OpenAPI.

### Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `auth` | Login Google (OIDC, código + PKCE), sessão, logout, lista de e-mails permitidos |
| `accounts` | Contas e cartões do usuário |
| `imports` | Upload, detecção de formato, prévia, confirmação, histórico |
| `transactions` | Listagem, filtros, edição, divisão em categorias, seleção múltipla |
| `categories` | Categorias e regras de categorização |
| `budgets` | Metas por categoria, ajuste por mês, sobra acumulada |
| `insights` | Avaliações e nota do mês |
| `projections` | Projeção e cenários salvos |
| `privacy` | Exportar e apagar dados, registro de consentimento |

### Endpoints principais

| Método e rota | Uso |
| --- | --- |
| `GET /v1/auth/google/start`, `GET /v1/auth/google/callback`, `POST /v1/auth/logout` | Login e sessão |
| `GET /v1/me` | Usuário, contas e estado do onboarding |
| `POST /v1/imports` (multipart) | Envia arquivo e devolve a prévia (`dry-run`) |
| `POST /v1/imports/{id}/commit` | Confirma e grava |
| `GET /v1/transactions?from&to&category&account&q&cursor` | Lista paginada por cursor |
| `PATCH /v1/transactions/{id}` | Categoria, observação, divisão |
| `POST /v1/transactions/bulk` | Ação em várias transações |
| `GET/PUT /v1/budgets?month` | Metas do mês |
| `GET /v1/insights?month` | Avaliações e nota |
| `GET /v1/projections?horizon` e `POST /v1/scenarios` | Projeção e cenários |
| `GET /v1/export`, `DELETE /v1/me` | LGPD: exportar e apagar |

### Convenções

- Dinheiro em centavos inteiros (`amount_cents`), negativo para saída. Datas em ISO 8601; mês como `YYYY-MM`.
- Paginação por cursor, nunca por página, para a lista continuar estável durante importações.
- Erros no formato `application/problem+json` com código estável que o front traduz para a mensagem em português.
- Toda consulta filtra por `user_id` na camada de repositório; nunca confiar em id vindo do cliente.
- Validação de entrada com schemas Zod compartilhados em `libs/contracts`.
- Operações de escrita idempotentes (importar o mesmo arquivo duas vezes não duplica nada).

### Jobs

Fila BullMQ no Redis: `import.parse` (arquivos grandes), `insights.recompute` (após importação ou edição de categoria), `files.purge` (apaga originais com mais de 30 dias) e `export.build`. O front acompanha o andamento por polling curto em `GET /v1/imports/{id}`; websocket fica para depois.

## 5. Modelo de dados

PostgreSQL 16. Todas as tabelas de dados do usuário carregam `user_id` e têm índice começando por ele. Migrations versionadas (Prisma ou Drizzle) rodando no pipeline.

| Tabela | Campos principais |
| --- | --- |
| `users` | id, google\_sub, email, nome, criado\_em, onboarding\_estado |
| `accounts` | id, user\_id, apelido, tipo (conta, cartão), banco, últimos dígitos |
| `imports` | id, user\_id, account\_id, arquivo (chave no storage), hash, formato, status, total, novas, duplicadas, erros, criado\_em |
| `transactions` | id, user\_id, account\_id, import\_id, data, `amount_cents` (assinado), descricao\_original, descricao\_norm, merchant\_id, category\_id, is\_transfer, transfer\_pair\_id, external\_id (FITID), dedupe\_key, observacao |
| `transaction_splits` | transaction\_id, category\_id, amount\_cents (soma igual ao total) |
| `categories` | id, user\_id, nome, cor, ícone, tipo (despesa, receita), ordem |
| `category_rules` | id, user\_id, padrão (contém, regex simples), category\_id, prioridade |
| `merchants` | id, nome normalizado, categoria sugerida (dicionário global e do usuário) |
| `budgets` | id, user\_id, category\_id, limite\_cents, rollover (bool), vigente\_desde |
| `budget_overrides` | budget\_id, mês, limite\_cents |
| `recurrences` | id, user\_id, merchant\_id, valor\_cents, dia, período, confiança, ativa |
| `scenarios` | id, user\_id, nome, deltas (JSON: tipo, valor, início, fim) |
| `insights` | id, user\_id, mês, tipo, payload (JSON), criado\_em, dispensado\_em |
| `consents` | id, user\_id, tipo, versão do texto, aceito\_em |
| `audit_log` | id, user\_id, ação, entidade, criado\_em (sem dados financeiros) |

### Restrições e índices

- `unique(user_id, account_id, dedupe_key)` em `transactions` impede duplicata mesmo se o arquivo for reenviado.
- Índices: `(user_id, data desc)`, `(user_id, category_id, data)` e busca de texto em `descricao_norm` (`pg_trgm`).
- `check` garantindo que a soma das divisões seja igual ao valor da transação.
- Exclusão de usuário em cascata, mais remoção dos arquivos no storage.

### Regras que o modelo precisa respeitar

- **Transferências entre contas próprias** ficam marcadas (`is_transfer`) e não contam como gasto nem como receita no orçamento.
- **Parcelas e assinaturas** são detectadas e viram `recurrences`, usadas na projeção.
- **Edição manual vence regra:** se a pessoa corrige uma categoria, o sistema oferece criar uma regra, mas nunca reescreve a escolha manual numa nova importação.
- **Valores nunca em ponto flutuante**, nem no banco (`bigint`) nem no código.

## 6. Pipeline de importação

O ponto mais arriscado do MVP: tudo depende de ler bem o extrato do Banco do Brasil. O pipeline é uma sequência de etapas pequenas e testáveis, sempre com prévia antes de gravar.

1. **Recebimento:** upload de até 10 MB, validação por tipo real do arquivo (não só extensão), cálculo de hash. Arquivo com hash já importado avisa "este arquivo já foi enviado".
2. **Detecção de formato:** OFX v1 (SGML) ou v2 (XML) e CSV (detecta delimitador, codificação ISO-8859-1 ou UTF-8, formato de data e de número brasileiro).
3. **Leitura:** parsers separados por formato, todos devolvendo o mesmo tipo `RawTransaction`.
4. **Normalização:** caixa, acentos, espaços, remoção de ruído ("COMPRA CARTAO", datas e códigos no fim) para formar `descricao_norm`.
5. **Deduplicação:** usa o `FITID` do OFX quando existe; senão, chave composta de conta, data, valor, descrição normalizada e número de sequência no dia (para duas compras iguais no mesmo dia).
6. **Transferências:** valores opostos entre contas do próprio usuário em até 3 dias viram par de transferência.
7. **Categorização:** primeiro as regras do usuário, depois o dicionário de estabelecimentos, e por fim "sem categoria" (sugestão por modelo fica para uma fase posterior).
8. **Prévia (dry-run):** mostra novas, duplicadas, com erro e as de categoria incerta, como na tela de revisão do onboarding.
9. **Confirmação:** grava tudo em uma transação do banco, dispara `insights.recompute` e registra o import.

### Comportamento com erro

- Arquivo inválido ou ilegível: nada é gravado, e a mensagem diz o que tentar (exportar OFX no internet banking).
- Importação parcial: linhas com problema vão para um relatório baixável e as demais seguem, só se a pessoa confirmar.
- Arquivos grandes (mais de \~2.000 linhas) rodam no worker, com status consultável.

### Qualidade

- Conjunto de arquivos de exemplo reais e anonimizados do BB (conta corrente e cartão, OFX e CSV) como testes de regressão (golden files).
- Teste de propriedade: importar o mesmo arquivo duas vezes nunca muda o total.
- **Antes de codar o parser de CSV, obter amostras reais:** o layout exato do BB precisa ser confirmado e não deve ser presumido.

## 7. Motores de orçamento, avaliação e projeção

Tudo vive em `libs/engine`, como funções puras (entrada e saída de dados, sem I/O). A API usa para gravar o resultado oficial; o Angular usa para recalcular cenários na hora, sem ida ao servidor.

### Orçamento

- **Ritmo do mês** = dia atual ÷ dias do mês. Uma meta está "no ritmo" se gasto ÷ limite não passa muito do ritmo.
- **Cor da meta:** verde abaixo de 80% do limite, âmbar de 80% a 99%, vermelho a partir de 100%.
- **Sobra acumulada (rollover)** opcional por categoria: o que sobrou entra como folga no mês seguinte.
- **Sobra do mês** = receitas do mês menos gastos até agora (transferências entre contas próprias ficam fora).

### Avaliações (insights)

| Tipo | Regra |
| --- | --- |
| Categoria acima do normal | Gasto do mês mais de 20% acima da média dos 3 meses anteriores, com diferença mínima de R$ 50 |
| Gasto incomum | Transação acima de média + 2,5 desvios padrão da categoria, com pelo menos 5 transações de histórico |
| Recorrência reajustada | Valor recorrente subiu mais de 3% |
| Nova assinatura | Recorrência vista pela primeira vez nos últimos 30 dias |
| Sequência de metas | Meses seguidos cumprindo uma meta |

Cada insight traz o dado de apoio (valores, período) para a tela poder explicar "por que estou vendo isso".

### Nota do mês (0 a 100)

40 pontos de metas no ritmo, 30 de sobra projetada para o fim do mês e 30 de estabilidade (pouca oscilação frente aos meses anteriores). O cálculo é mostrado na tela, sem caixa-preta.

### Projeção

1. **Base:** recorrências conhecidas (aluguel, parcelas, assinaturas) mais a parte variável, estimada por média dos 3 a 6 últimos meses com peso maior nos mais recentes (decaimento exponencial).
2. **Projeção por categoria no mês corrente** = gasto até agora + recorrências que ainda vencem + taxa diária variável × dias restantes.
3. **Faixa de incerteza:** ± k · σ · √n, em que σ é o desvio mensal do saldo líquido e n é a distância em meses. O protótipo usa uma faixa linear só para ilustrar; a implementação real usa a raiz de n.
4. **Cenários** são listas de ajustes sobre a base: "cortar Lazer em 20%" soma cerca de R$ 70 por mês a partir de novembro; "nova parcela de R$ 400" subtrai a partir de janeiro; "renda extra de R$ 800" entra só em dezembro. Ligar e desligar cenários apenas soma ou tira deltas.

A projeção precisa avisar quando o histórico é curto (menos de 3 meses): mostra faixa mais larga e o rótulo "estimativa com pouco histórico".

### Testes do motor

Testes de tabela com casos escritos a mão e fixtures dos dados de exemplo do protótipo; o resultado de cada caso tem de bater com o que as telas mostram.

## 8. Segurança e LGPD

Dados financeiros são sensíveis. O princípio é: guardar o mínimo, proteger bem e deixar a pessoa mandar nos próprios dados.

### Autenticação e sessão

- Login só com Google (OIDC, código de autorização com PKCE, escopos `openid`, `email`, `profile`). A verificação em duas etapas fica a cargo do Google.
- No MVP, somente e-mails de uma lista permitida entram.
- Sessão por cookie `HttpOnly`, `Secure`, `SameSite=Lax`, com expiração deslizante; proteção CSRF por token em cabeçalho.
- Nenhuma senha, token de banco ou credencial bancária é pedida ou guardada.

### Proteção dos dados

- TLS em todo lugar; banco e storage com criptografia em repouso; backups diários criptografados, retidos por 30 dias.
- Região do Brasil (sa-east-1 ou southamerica-east1).
- Arquivos originais enviados ficam no máximo 30 dias e são apagados automaticamente.
- Logs sem dados pessoais: nada de descrição de transação, valores ou e-mail completo.
- Segredos em gerenciador de segredos, nunca no repositório.

### Endurecimento da aplicação

- Content Security Policy rígida, sem `unsafe-inline`; cabeçalhos de segurança padrão (HSTS, `X-Content-Type-Options`, `Referrer-Policy`).
- Limite de requisições por usuário e por IP, e limite extra no upload.
- Upload: tipo real, tamanho, nenhum arquivo executado ou servido de volta; parsers protegidos contra XML malicioso (sem entidades externas).
- Dependências com varredura automática (Dependabot e `npm audit` no CI).

### LGPD na prática

| Direito ou dever | Como o sistema atende |
| --- | --- |
| Acesso e portabilidade | `GET /v1/export` gera JSON e CSV de tudo |
| Eliminação | `DELETE /v1/me` apaga dados e arquivos, com confirmação |
| Consentimento | Registro com versão do texto e data, na primeira entrada |
| Transparência | Política de privacidade e termos em linguagem simples, linkados no login |
| Minimização | Só o necessário; sem rastreadores de terceiros |
| Incidente | Plano de resposta; comunicação à ANPD e aos titulares em prazo curto (cerca de 3 dias úteis, a confirmar com assessoria jurídica) |

Enquanto o Jano for de uso pessoal, o tratamento é do próprio titular. Se for aberto a outras pessoas, revisar base legal, encarregado (DPO) e política com um advogado antes. Este plano não substitui parecer jurídico.

## 9. PWA, desempenho, acessibilidade e testes

### PWA

- `@angular/service-worker`: o shell do app fica em cache; dados ficam em modo leitura offline (últimos dados vistos), com aviso claro "sem conexão, mostrando dados de há X minutos".
- Manifesto com os ícones da opção B, cor do tema teal e splash estática; a splash animada roda dentro do app.
- Escrita offline não entra no MVP (importação e edição exigem conexão).

### Desempenho (orçamentos medidos no CI)

| Métrica | Meta |
| --- | --- |
| LCP em celular intermediário, 4G | abaixo de 2,5 s |
| JavaScript inicial | cerca de 200 KB comprimido |
| Lista de transações | rolagem fluida com 10 mil linhas (virtual scroll) |
| Troca de cenário na projeção | resposta imediata, cálculo local |

Lighthouse CI falha o build se uma meta estourar. ECharts entra por `@defer` e só nas telas que usam.

### Acessibilidade

- WCAG 2.2 AA: contraste verificado nos dois temas, foco visível, ordem de tabulação lógica, alvos de toque de 44 px.
- Cor nunca é a única informação: as metas têm rótulo e ícone além de verde, âmbar e vermelho.
- Gráficos com resumo textual e tabela alternativa; anúncios de leitor de tela (`aria-live`) para resultado de importação e erros.
- `prefers-reduced-motion` desliga a splash animada e transições.
- `axe-core` nos testes e verificação manual com leitor de tela em cada fase.

### Estratégia de testes

| Nível | Ferramenta | O que cobre |
| --- | --- | --- |
| Unitário | Vitest ou Jest | `engine`, parsers, normalização, formatação de moeda |
| Componente | Testing Library e Storybook | `jano-ui` em todos os estados e temas |
| Integração | Supertest e Postgres em contêiner | API, permissões por usuário, importação idempotente |
| Golden files | Arquivos OFX e CSV anonimizados | Regressão dos parsers |
| Ponta a ponta | Playwright, viewport mobile e desktop | Login (simulado), importar, criar meta, ver projeção |
| Acessibilidade | axe-core e Lighthouse CI | Regras automáticas em cada tela |
| Regressão visual | Storybook com snapshots | Componentes do DS |

Regra de ouro: bug de cálculo ou de importação só é corrigido depois de virar um teste que falha.

## 10. Entrega, ambientes e operação

### Ambientes

| Ambiente | Uso | Dados |
| --- | --- | --- |
| `dev` | Local com Docker Compose (Postgres, Redis, storage local) | Fixtures sintéticas |
| `staging` | Espelho da produção, para validar antes de publicar | Sintéticos, nunca dados reais |
| `prod` | Uso real | Dados reais, região do Brasil |

### Pipeline (GitHub Actions)

1. A cada pull request: lint, checagem de tipos, testes unitários e de integração, build do Angular, Storybook, Lighthouse CI e axe.
2. Nx roda só o que foi afetado (`nx affected`) e usa cache, para o ciclo ficar rápido.
3. Merge na `main`: publica em `staging` automaticamente; `prod` com aprovação manual.
4. Migrations do banco rodam no pipeline antes do deploy da API, sempre compatíveis com a versão anterior (expandir, migrar, depois contrair).
5. Rollback: front é estático e versionado, volta em segundos; API volta para a imagem anterior.

### Infraestrutura

- Front: arquivos estáticos em bucket com CDN. API e worker em contêiners gerenciados (Cloud Run, ECS Fargate ou similar). Postgres gerenciado com backup automático, Redis gerenciado pequeno.
- Tudo descrito em Terraform; nada criado à mão no console.
- Custo estimado para uso pessoal: baixo (algumas dezenas de dólares por mês), a confirmar ao escolher o provedor.

### Observabilidade

- OpenTelemetry para traces e métricas; Sentry para erros no front e na API (com remoção de dados pessoais).
- Alertas: falha de importação acima do normal, fila parada, erro 5xx, certificado perto de vencer.
- Verificação externa de disponibilidade (uptime check) na rota de saúde.
- Teste de restauração de backup feito de verdade, a cada trimestre.

## 11. Fases e backlog

Estimativa para uma pessoa dedicada: cerca de 14 a 16 semanas até o MVP polido. Cada fase termina com algo usável e demonstrável.

| Fase | Duração | Entregas | Pronto quando |
| --- | --- | --- | --- |
| **F0 Fundação** | \~2 sem | Monorepo Nx, CI, `jano-ui` com tokens e componentes base, Storybook, login Google, schema base, splash e login | Você entra com o Google em staging e vê o shell vazio nos dois temas |
| **F1 Importação e transações** | \~3 sem | Parsers OFX e CSV, deduplicação, categorização por regra, prévia, onboarding, lista com filtros, busca, edição e divisão | Você importa um extrato real do BB e corrige categorias |
| **F2 Orçamento** | \~2 a 3 sem | Metas por categoria, ritmo, cores, rollover, tela Início com resumo | Metas refletem os gastos reais do mês |
| **F3 Avaliações** | \~2 a 3 sem | Motor de insights, nota do mês, maiores gastos, dispensar insight | Avaliações batem com os testes de tabela |
| **F4 Projeções** | \~2 a 3 sem | Projeção com faixa, recorrências, cenários locais e salvos | Ligar um cenário muda o gráfico na hora |
| **F5 Polimento** | \~2 sem | PWA offline de leitura, tema escuro final, a11y, exportar e apagar dados, desempenho, endurecimento de segurança | Metas de desempenho e checklist de segurança cumpridos |
| **F6 Open Finance (opcional)** | a definir | Conector de agregador atrás da interface `BankConnector`, renovação de consentimento | Transações chegam sem importar arquivo |

### Primeiros itens do backlog (ordem de ataque)

1. Criar o workspace Nx com `web`, `api`, `ui`, `engine`, `contracts` e regras de dependência.
2. Script `tokens.json` para variáveis CSS e TypeScript.
3. Componentes `Button`, `Chip`, `Field`, `Banner` e `Sheet` com histórias.
4. Login Google ponta a ponta com sessão e lista permitida.
5. Conseguir 2 a 3 extratos reais anonimizados do BB (OFX e CSV) para os golden files.
6. Esquema do banco e primeira migration.
7. Parser OFX com deduplicação e prévia.

### Definição de pronto (cada item)

Testes escritos, acessível por teclado, visível nos dois temas e nos dois tamanhos, sem aviso novo de lint, e comparado com a tela do protótipo.

## 12. Riscos e decisões em aberto

### Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Formato real dos extratos do BB diferente do esperado | Alto: sem importação não há produto | Obter amostras reais antes da F1; parsers tolerantes; relatório de linhas com erro |
| Categorização imprecisa no começo | Médio: metas e avaliações perdem confiança | Prévia com revisão, regras aprendidas das correções, dicionário de estabelecimentos |
| Custo e dependência de agregador Open Finance | Médio: afeta a F6 | Manter o `BankConnector` desacoplado; importação por arquivo continua funcionando |
| Renovação periódica do consentimento (Open Finance) | Baixo a médio | Aviso no app antes de vencer; fallback para arquivo |
| Desempenho de gráficos e listas em celular fraco | Médio | Virtual scroll, ECharts sob demanda, orçamento de desempenho no CI |
| Crescimento de escopo | Alto para o prazo | Fases fechadas; backlog separado; novidades só entram trocando algo |
| Segurança de dados financeiros | Alto | Seção 8: mínimo de dados, criptografia, revisão antes de abrir para outras pessoas |
| Perder acesso à conta Google | Médio | Exportação regular; avaliar e-mail de recuperação ou segundo método de login depois |
| LGPD ao abrir para terceiros | Alto | Parecer jurídico antes; uso pessoal no MVP |

### Decisões em aberto (preciso da sua resposta)

1. **Back-end:** NestJS (recomendado, mesma linguagem e tipos que o Angular) ou outra tecnologia que você prefira.
2. **Hospedagem:** AWS, Google Cloud ou outro provedor, sempre em região do Brasil.
3. **Acesso:** lista de e-mails permitidos (recomendado no MVP) ou cadastro aberto.
4. **Contas iniciais:** quais contas e cartões do BB serão importados primeiro.
5. **Usuários:** só você, ou casal e família (muda o modelo de dados e as permissões).
6. **Agregador pago:** vale pesquisar custos para a F6 ou fica fora do escopo por enquanto.
7. **Quem constrói:** uma pessoa dedicada, equipe ou eu gerando o código em etapas.

Próximo passo sugerido: responder as decisões 1 a 5 e enviar um extrato real anonimizado, para eu começar a F0.

## 13. Atualização: arquitetura sem servidor (decidida em 27/10/2026)

**Esta seção substitui o que for diferente nas seções 2, 4, 5, 6 e 10.** O objetivo é custo zero e nada para manter, já que o Jano começa de uso pessoal (uma pessoa, depois a esposa com conta separada).

| Antes | Agora |
| --- | --- |
| CDN + bucket | **GitHub Pages** (workflow `deploy.yml`, `base href /app-jano/`, `404.html` para as rotas do app). Exige repositório público no plano gratuito |
| API NestJS + worker + Redis | **Nenhum servidor.** Importação, deduplicação, avaliações e projeções rodam no navegador (`@jano/engine` já é pura) |
| PostgreSQL | **Cloud Firestore** (plano Spark) |
| Login Google na API, sessão por cookie | **Firebase Authentication** com Google |
| Lista de e-mails na API | Coleção `allowlist/{email}` conferida pelas regras do Firestore |
| `GET /v1/export` e `DELETE /v1/me` | Exportar e apagar feitos pelo próprio app, sobre `users/{uid}` |

### Modelo no Firestore

Tudo do usuário fica sob `users/{uid}`, o que dá o isolamento entre pessoas (sua esposa terá outro `uid`, sem ver os seus dados):

- `accounts`, `categories`, `rules`, `budgets`, `recurrences`, `scenarios`, `insights`, `imports`.
- `transactions`: o **id do documento é a chave de deduplicação** (FITID ou hash de conta + data + valor + descrição normalizada + sequência). Reimportar o mesmo arquivo sobrescreve, nunca duplica.
- Valores em centavos inteiros e datas em `AAAA-MM-DD`, como antes.

### Regras de segurança

`firestore.rules`: só lê e grava quem está autenticado, com e-mail verificado e presente em `allowlist`, e somente sob o próprio `uid`. Todo o resto é negado.

### O que muda nas fases

- **F0:** login Firebase, regras, deploy no Pages, tokens e componentes (em andamento; monorepo, login e deploy já estão no repositório).
- **F1:** o parser de OFX e CSV passa a ser uma biblioteca de navegador (sem dependências de Node), com os mesmos arquivos de teste. Escrita em lote no Firestore, com prévia antes de gravar.
- **F2 a F4:** igual ao plano; os totais por mês e categoria são somados no navegador a partir das transações do período, com cache offline do Firestore.

### Limites e cuidados

- Cota gratuita de leituras por dia (cerca de 50 mil, a confirmar no console do Firebase): carregar só o período necessário e usar o cache offline.
- Sem backup diário automático no plano gratuito: oferecer exportação JSON/CSV no app e lembrar de exportar de vez em quando.
- O código fica público, os dados não: não versionar extratos reais; arquivos de teste só anonimizados ou sintéticos.
- Se o Jano for aberto a outras pessoas no futuro, rever esta arquitetura (agregadores, jobs e conformidade com a LGPD pedem servidor).

### Configuração inicial do Firebase (uma vez)

1. Criar o projeto no console do Firebase (Spark).
2. Ativar o login Google e autorizar o domínio `darlondjc.github.io`.
3. Criar o Firestore em modo produção e colar `firestore.rules`.
4. Criar `allowlist` com um documento cujo id é o seu e-mail.
5. Copiar a configuração do app Web para `apps/web/src/environments/firebase.ts`.
6. No GitHub, em Settings → Pages, escolher **GitHub Actions** como fonte.
