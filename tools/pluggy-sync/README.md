# pluggy-sync

Traz suas transações do Open Finance (via [Meu Pluggy](https://meu.pluggy.ai), gratuito para
o próprio CPF) para o Jano. Roda na sua máquina e grava direto no Firestore, no mesmo formato
da importação por arquivo: mesma deduplicação, mesmas regras de categoria, mesma detecção de
transferências. Rodar de novo não duplica nada.

## Configuração (uma vez)

1. **Pluggy.** Conecte seus bancos no Meu Pluggy. No [dashboard](https://dashboard.pluggy.ai),
   crie uma aplicação de desenvolvimento, adicione o conector MeuPluggy e autorize cada banco
   pelo app de demonstração. Anote o `client_id`, o `client_secret` e o **item id** de cada
   banco.
2. **Firebase.** No console, em Configurações do projeto → Contas de serviço, gere uma chave
   privada (JSON). Guarde **fora do repositório**: ela tem acesso total ao banco.
3. **`.env.pluggy`** na raiz (está no `.gitignore`):

   ```sh
   PLUGGY_CLIENT_ID=...
   PLUGGY_CLIENT_SECRET=...
   GOOGLE_APPLICATION_CREDENTIALS=/caminho/fora/do/repo/jano-service-account.json
   ```

4. **`pluggy.config.json`** na raiz (também no `.gitignore`), a partir de
   `pluggy.config.example.json`. O `uid` está em Authentication → Users no console.
5. Rode `npm run pluggy -- contas` e ligue cada conta da Pluggy a uma conta do Jano em
   `"contas"`.

## Uso

```sh
npm run pluggy -- sync --seco                     # mostra o que entraria, sem gravar
npm run pluggy -- sync                            # últimos 45 dias
npm run pluggy -- sync --desde 2026-09-01         # período maior
```

## Cuidados

- **Não misture com arquivo no mesmo período.** A Pluggy e o OFX identificam o mesmo
  lançamento de jeitos diferentes, então a deduplicação não casa um com o outro. Use
  `"inicio"` com o primeiro dia que ainda não veio por arquivo, uma data por conta:
  `{ "conta-corrente": "2026-10-28", "cartao-de-credito": "2026-10-06" }`. No cartão é o dia
  seguinte ao fechamento da última fatura importada, não a data de hoje.
- **A autorização do Meu Pluggy vence em 1 ano.** Quando vence, a sincronização volta vazia,
  sem erro. Renove em Applications → sua aplicação → Demo → Connect Account → MeuPluggy e
  confira se o itemId mudou.
- **Cartão só entra quando a fatura fecha.** Compras da fatura aberta vêm da Pluggy como
  pendentes, e pendentes ficam de fora. Quando a fatura fecha, chegam todas de uma vez com a
  data da compra; por isso a janela padrão é de 45 dias, um ciclo inteiro com folga.
- **Como a deduplicação funciona.** O Meu Pluggy não repassa o id do banco (`providerId`),
  então a chave é data + valor + descrição. Ela sobrevive a reconectar o banco, quando a
  Pluggy troca todos os ids. Se o banco refizer um lançamento com outra data, valor ou
  descrição, ele aparece duas vezes e você apaga o antigo no app. O script não remove
  lançamentos que sumiram da Pluggy.

## Sincronização diária (GitHub Actions)

O workflow `.github/workflows/pluggy-sync.yml` roda `sync` todo dia às 6h de Brasília. Ele só
dispara depois de estar na branch `main`. Cadastre em Settings → Secrets and variables →
Actions → New repository secret:

| Secret                     | Conteúdo                                       |
| -------------------------- | ---------------------------------------------- |
| `PLUGGY_CLIENT_ID`         | Client ID da aplicação na Pluggy               |
| `PLUGGY_CLIENT_SECRET`     | Client Secret da aplicação na Pluggy           |
| `PLUGGY_CONFIG`            | O conteúdo inteiro do seu `pluggy.config.json` |
| `FIREBASE_SERVICE_ACCOUNT` | O conteúdo inteiro do JSON da conta de serviço |

Para testar sem esperar o horário: Actions → Sincronizar Open Finance → Run workflow.

O repositório é público, então os logs também são. A sincronização imprime só nomes de
conta e contagens, nunca saldos nem lançamentos. Não rode `--seco` no workflow. O GitHub
desliga agendamentos de repositórios públicos sem commits por 60 dias; ele avisa por
e-mail e basta reativar em Actions.

## Saldo

A cada sincronização o saldo de todas as contas do banco (inclusive as sem mapeamento, como a
poupança) vai para `users/{uid}/balances`, com a data da atualização. No cartão, o saldo é o
valor da fatura em aberto.

Nos cartões, o mesmo documento guarda também `credito` (limite, disponível, fechamento,
vencimento, mínimo e bandeira, quando o banco informa) e `faturaAberta`: um resumo das compras
desde o último fechamento, inclusive as pendentes, por categoria (com as suas regras) e as
maiores. As pendentes nunca viram transação: a Pluggy troca o id delas no fechamento. O log só
mostra quantos cartões foram resumidos, nunca valores.

## Categorias automáticas

Cada lançamento recebe a primeira categoria encontrada nesta ordem, desde que ela exista na
sua conta: regra sua, dicionário de estabelecimentos, categoria do categorizador da Pluggy e,
nas compras do cartão, o ramo do estabelecimento (código MCC da bandeira). O categorizador da
Pluggy também marca como transferência o que é entre contas suas, aplicação automática e
pagamento de fatura.

O categorizador da Pluggy vem ligado no trial e depois é recurso pago; sem ele, valem as
regras, o dicionário e o MCC. O `sync --seco` mostra quantos lançamentos vieram com sugestão.

A cada sincronização, lançamentos dos últimos 45 dias que continuam sem categoria, e que você
não editou, são reavaliados. Depois, o que segue sem categoria na janela recebe a categoria de
outros lançamentos da mesma loja, também da janela: a que você escolheu à mão ou, se nunca
escolheu, a mais frequente. A loja é a descrição sem o prefixo da operação nem a hora, então
"COMPRA C/CARTAO 27/10 17:15 PADARIA X" e "PADARIA X" são a mesma.

A sincronização só lê e altera a janela de 45 dias (uma consulta por execução). Meses
anteriores ficam como estão, para não gastar a cota do Firestore nem obrigar o app a relê-los.

A sincronização nunca troca uma categoria que já existe. Suas regras valem para o que chega
(no app, "Alterar também as transações futuras"); para mudar as que já estão gravadas, use
"Alterar também as transações passadas" ao editar a transação. Quando mais de uma regra casa,
vale a de trecho mais longo e, no empate, a mais recente. Regras só com palavras da operação
("COMPRA C CARTAO", "PIX ENVIADO") são ignoradas.

## Cache do app

O app guarda no aparelho os meses que terminaram há mais de 45 dias e não os relê do servidor
(o plano gratuito do Firestore dá 50 mil leituras por dia). Para ele saber quando um desses
meses mudou, a sincronização grava em `users/{uid}/meta/meses` a data de alteração de cada mês
em que inseriu ou categorizou lançamentos. Quem altera transações direto no Firestore, fora do
app e deste script, precisa atualizar esse documento também.
