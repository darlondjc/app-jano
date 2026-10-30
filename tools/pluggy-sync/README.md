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
npm run pluggy -- sync                            # últimos 30 dias
npm run pluggy -- sync --desde 2026-09-01         # período maior
```

## Cuidados

- **Não misture com arquivo no mesmo período.** A Pluggy e o OFX identificam o mesmo
  lançamento de jeitos diferentes, então a deduplicação não casa um com o outro. Use
  `"inicio"` com o primeiro dia depois da última importação por arquivo.
- O consentimento do Open Finance vence (em geral 12 meses). Quando a Pluggy parar de trazer
  dados, renove a autorização no Meu Pluggy.
- Lançamentos pendentes ficam de fora até serem confirmados pelo banco.
