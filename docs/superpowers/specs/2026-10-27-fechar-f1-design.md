# Fechar a F1: total do mês certo, categorias que aprendem, Transações completa e onboarding

Data: 27/10/2026. Referências visuais: `docs/design/` (leia `docs/design/README.md` primeiro). Plano técnico: `docs/design/plano-tecnico.md`, seções 6, 11 e 13.

## Por que agora

O dono do app importou hoje um extrato da conta e duas faturas do cartão. Duas coisas incomodaram.

O Início mostra um gasto do mês alto demais. A causa é contagem dupla. O extrato OFX da conta traz o pagamento da fatura como débito comum. As faturas em PDF trazem as compras uma por uma. Os dois entram como gasto. Hoje só o crédito de pagamento dentro da fatura é marcado como transferência (`fatura-bb.ts`); o débito no extrato não é.

Muitas transações chegam sem categoria. A importação usa só `DEFAULT_RULES` (20 padrões) e o grupo do BB nas faturas. O extrato da conta não tem grupo. A coleção `users/{uid}/rules` existe em `paths.ts`, mas nada grava nem lê dela. Corrigir uma categoria não ensina nada ao app.

## O que é sucesso

1. Depois de importar extrato e faturas de um mês, o gasto do Início bate com o gasto real: cada compra do cartão conta uma vez, e o pagamento da fatura fica fora do total.
2. Na segunda importação de um mês, a maior parte das transações já chega categorizada pelas regras que a pessoa criou na primeira.
3. A tela de Transações faz o que os protótipos mostram: busca, filtros, seleção múltipla, detalhe com dividir, criar regra e marcar transferência.
4. Uma conta nova (por exemplo, a da esposa, com outro `uid`) passa pelo onboarding completo de 5 passos.

## Fora de escopo

1. Parser de CSV. O dono usa OFX do extrato e PDF da fatura. O plano exige amostras reais do BB antes de escrever esse parser. Os textos das telas dizem "OFX do extrato ou PDF da fatura".
2. Open Finance e sincronização automática. Aparecem só como o cartão "Sincronização automática: em breve" do protótipo.
3. Tela de Avaliações, Projeções, tema escuro, PWA offline (F3 a F5).
4. Sugestão de categoria por modelo de aprendizado. Aprender aqui significa regras de texto.

## O que não pode acontecer

1. Uma edição manual (categoria escolhida na mão, transferência marcada na mão, divisão) ser sobrescrita por regra, reimportação ou pela correção dos dados existentes. O campo `categoryIsManual` já existe para isso; a mesma garantia vale para transferência e divisão.
2. O total do Início ficar menor que o real sem aviso. Se houver pagamento de fatura no extrato e nenhuma compra de cartão importada para aquele ciclo, o app avisa.
3. Divisão cuja soma das partes não feche o valor da transação.

## Decisões tomadas com o dono

### 1. Pagamento de fatura e transferências

Pagamento de fatura no extrato da conta é sempre transferência. O dono importa extrato e faturas todo mês, então as compras sempre chegam pela fatura.

Reconhecimento automático na importação do OFX, por padrões na descrição normalizada. Uma linha reconhecida chega com `isTransfer: true` e sem categoria.

Padrão de pagamento de fatura, confirmado pelo dono: no extrato do BB a linha vem como "Pagto cartão crédito", que normalizada fica `PAGTO CARTAO CREDITO`. Esse é o padrão. Ele não colide com a limpeza de `normalizeDescription`, que só remove o prefixo `PAGAMENTO (COM )?CARTAO ` de compras no débito. Não use padrões mais largos (`PAGAMENTO CARTAO`, `OUROCARD`) sem uma linha real que os justifique, para não tirar compras no débito do total.

O reconhecimento automático do sistema cobre só o pagamento de fatura. BB Rende Fácil, poupança e outros movimentos ficam de fora por decisão do dono: ele quer que isso seja parametrizável, não embutido. O caminho é a regra de transferência do usuário (seção 2): ao marcar uma transação como transferência, o app oferece "Sempre que a descrição contiver ‘X’, marcar como transferência", com a mesma opção de aplicar às antigas. Assim o dono decide, por exemplo, criar `BB RENDE FACIL` como transferência quando quiser.

Marcação manual, como no protótipo `Transacoes-Desktop.dc.html` e `Transacoes-Selecao.dc.html`: botão "Marcar como transferência" no detalhe e "Marcar transferência" na barra de seleção múltipla. Também precisa desmarcar. Transferência aparece com a etiqueta "Transferência · fora do total" e cor `text-2`.

Aviso de fatura faltando: depois de importar um extrato, se houver pagamento de fatura reconhecido e nenhuma transação de conta tipo `cartao` com data nos 40 dias anteriores ao pagamento, a prévia e o resumo da importação mostram um banner de atenção: "Pagamento de fatura de R$ X em DD/MM, mas nenhuma fatura importada para esse período. Importe a fatura para o gasto do cartão entrar no mês." A janela de 40 dias é chamada minha; ajuste se os dados reais pedirem.

### 2. Regras de categorização que aprendem

Modelo de regra, gravado em `users/{uid}/rules`: `{ pattern: string (descrição normalizada, maiúscula), categoryId: string | null, transfer: boolean, createdAt }`. Exatamente um dos dois efeitos: categoria ou transferência. Regras do usuário vencem o dicionário padrão; entre regras do usuário, vence o padrão mais longo (mais específico), e no empate a mais recente. Chamada minha.

Ordem de decisão na importação, por transação: transferência reconhecida pelo sistema; regra do usuário; dicionário padrão; grupo do BB na fatura (`bankCategoryToName`); sem categoria.

Criar regra segue `Transacoes-Desktop.dc.html` e `Transacoes-SemSugestao.dc.html`: ao trocar a categoria de uma transação, o app oferece "Sempre que a descrição contiver ‘X’, usar Categoria", com o texto editável (sugestão inicial: a descrição normalizada sem números) e a opção "Aplicar também a N transações antigas". Aplicar às antigas só muda transações sem edição manual.

Gestão das regras: uma lista simples para ver e apagar regras (de categoria e de transferência), acessível a partir de Categorias. Não está nos protótipos; siga os componentes do design system (lista em cartão, botão fantasma "Apagar" com confirmação).

Dicionário padrão ampliado: mais nomes comuns no Brasil (supermercados, farmácias, postos, apps de transporte e comida, streaming, operadoras, contas de consumo) e alinhado às categorias padrão atuais (`DEFAULT_CATEGORIES`): posto vai para Combustível, drogaria e farmácia vão para Farmácia, e não para Transporte e Saúde. A lista exata fica com quem constrói; os padrões que já existem continuam funcionando.

### 3. Tela de Transações

Segue `Transacoes-Mobile`, `Transacoes-Desktop`, `Transacoes-Filtros`, `Transacoes-Selecao`, `Transacoes-Vazio`, `Transacoes-SemSugestao` e `Transacoes-DesktopEstados`.

Busca por descrição. Filtros por conta, categoria (inclui "Sem categoria"), período, faixa de valor e "Transferências". No celular, filtros completos em bottom sheet com chips de atalho; no desktop, coluna fixa à esquerda. A busca e os filtros valem para o mês selecionado; o filtro de período troca o intervalo carregado. Para respeitar a cota do Firestore (cerca de 50 mil leituras por dia), não carregue o histórico inteiro a cada busca.

Seleção múltipla com barra de ação: trocar categoria e marcar transferência em lote.

Detalhe da transação (painel lateral no desktop, sheet no celular): trocar categoria, criar regra, marcar ou desmarcar transferência, dividir em categorias.

Dividir em categorias: a transação ganha uma lista de partes `{ categoryId, amountCents }` cuja soma é igual a `amountCents`. O formulário não deixa salvar se não fechar e mostra quanto falta. Uma transação dividida conta em cada categoria pela sua parte em `monthTotals` e em `insights.ts` do `@jano/engine`. Desfazer a divisão volta para uma categoria só.

### 4. Onboarding completo

Segue `Onb-M1` a `Onb-M9` e `Onb-Desktop`, `Onb-D2` a `Onb-D5`, `Onb-DesktopEstados`, `Onb-DesktopInicio`.

Entra quem não tem nenhuma transação: um guard leva para `/boas-vindas`; quem já tem dados nunca vê o onboarding de novo sem pedir. Rotas sugeridas pelo plano: `/boas-vindas` e `/importar`.

Passos: 1 boas-vindas com as três garantias; 2 como baixar o extrato e a fatura; 3 enviar arquivo e conferir (período, novas, duplicadas, primeiras linhas), com os estados arquivo inválido e importação parcial; 4 revisar categorias; 5 primeiras metas propostas pela média dos últimos 3 meses por categoria, editáveis e opcionais ("Pular por enquanto"); tela de conclusão com os números da importação.

Diferenças em relação ao protótipo, decididas: o passo 2 ensina a baixar o OFX do extrato e o PDF da fatura (não CSV); o estado de arquivo inválido fala de OFX e PDF de fatura do BB; o passo 3 aceita vários arquivos em sequência (extrato e faturas), um de cada vez, voltando ao passo 3 com "Enviar outro arquivo".

"Menos certeza" no passo 4, chamada minha: primeiro as sem categoria, depois as que vieram do dicionário padrão ou do grupo do BB. As que vieram de regra criada pela pessoa não aparecem, porque ela já decidiu.

O passo 4 (revisar categorias) também roda depois de toda importação feita pela tela de Transações, não só no onboarding. Ali a pessoa confirma ou troca e pode criar regras.

Lembrete no Início, como `Onb-M9` e `Onb-DesktopInicio`: "Última importação há N dias. Os dados do mês podem estar incompletos." com o botão "Importar novo extrato", quando a última importação tiver mais de 10 dias. A data vem dos registros em `users/{uid}/imports`. O limite de 10 dias é chamada minha.

### 5. Correção dos dados já gravados

Rotina única, disparada uma vez por usuário e registrada (por exemplo, um campo de versão de migração em `users/{uid}`), que percorre as transações existentes e:

1. marca como transferência os pagamentos de fatura reconhecidos, se a pessoa não tiver editado essa transação na mão;
2. aplica regras e dicionário às transações sem categoria e sem edição manual.

Nada que tenha `categoryIsManual: true` muda. A pessoa vê um aviso do que foi corrigido ("12 pagamentos de fatura saíram do total; 84 transações ganharam categoria").

## Restrições do projeto

Arquitetura sem servidor: Angular no GitHub Pages, Firebase Auth e Firestore no plano gratuito, tudo sob `users/{uid}` (`firestore.rules` já cobre subcoleções novas). Lógica pura (reconhecimento de transferência, ordem das regras, divisão, metas pela média) mora nas libs (`@jano/import-file`, `@jano/engine`) com testes; o app só orquestra. Dinheiro sempre em centavos inteiros. Componentes visuais vêm de `@jano/ui` e dos tokens. Textos seguem a voz do design system (`docs/design/design-system/project/README.md`). CI roda `nx affected -t lint test build`.

## Deixado para quem constrói

Estrutura de componentes e serviços, nomes de arquivos, como dividir o trabalho em etapas, forma exata de guardar as divisões no documento da transação, a lista final do dicionário padrão, e o desenho da lista de regras dentro do design system.
