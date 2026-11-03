# Deploy

A API roda na Vercel e o banco no Supabase, ambos no plano gratuito.

## 1. Supabase

1. Crie um projeto e guarde a senha do banco. Prefira uma senha só com letras e números: outros caracteres precisam ser codificados na URL.
2. **Desligue a Data API** em Integrations → Data API → Overview, desmarcando "Enable Data API". A API do Helpy não usa esse recurso, e deixá-lo ligado expõe o banco a uma API pública extra. As tabelas também têm RLS, como segunda camada.
3. Clique em **Connect** e copie duas connection strings:
   - **Transaction pooler** (porta 6543)
   - **Session pooler** (porta 5432)

Acrescente estes parâmetros ao final de cada uma:

| Variável | Origem | Parâmetros |
| --- | --- | --- |
| `DATABASE_URL` | Transaction pooler | `?pgbouncer=true&uselibpqcompat=true&sslmode=require` |
| `DIRECT_URL` | Session pooler | `?uselibpqcompat=true&sslmode=require` |

Sem o `sslmode`, a conexão não é criptografada.

## 2. Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório e defina o **Root Directory** como `apps/api`. O framework **NestJS** é detectado sozinho: não altere os comandos de build.
2. Confirme que a **Production Branch** é a `main`.
3. Em **Environment Variables**, adicione estas variáveis **apenas no ambiente Production**:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Do passo anterior |
| `DIRECT_URL` | Do passo anterior |
| `JWT_ACCESS_SECRET` | Gere com o comando abaixo |
| `CORS_ORIGINS` | URL do front, ou deixe vazio se usar o rewrite descrito abaixo |
| `TRUST_PROXY` | **Obrigatória.** Número de saltos de proxy confiáveis na frente da API. Comece com `1` e confirme com as checagens da seção 6 |

Defina `TRUST_PROXY` **antes do primeiro deploy que inclui o endpoint de cadastro**. Sem ela, o limite de requisições é global: cerca de 5 requisições por minuto de qualquer pessoa bloqueiam o cadastro para todos os visitantes, e 10 bloqueiam o login. Não defina `THROTTLE_DISABLED` na Vercel (veja a seção 6).

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

4. Faça o deploy. O build de produção aplica as migrations antes de publicar. Se elas falharem, o deploy falha e a versão anterior continua no ar.

Deploys de preview não têm banco, de propósito, para nunca alterar os dados de produção. Eles terminam o build, mas não respondem às rotas.

## 3. Criar o primeiro admin

Rode no seu computador, dentro de `apps/api`, uma única vez. Use uma senha forte, que você não usa em outro lugar. As variáveis valem só para esta janela do terminal e têm prioridade sobre o `.env`.

No PowerShell:

```powershell
$env:DIRECT_URL = "<DIRECT_URL do Supabase>"
$env:SEED_ADMIN_NAME = "Admin"
$env:SEED_ADMIN_EMAIL = "<seu e-mail>"
$env:SEED_ADMIN_PASSWORD = "<senha forte>"
npm run db:seed
```

Depois, feche a janela do terminal.

## 4. Conferir

- `https://<sua-api>.vercel.app/api/v1/health` responde `{"status":"ok"}`.
- `https://<sua-api>.vercel.app/docs` abre o Swagger. Erros 404 de `swagger-ui*` no console são esperados: a interface vem de um CDN.
- O login pelo Swagger funciona, e o cookie `refresh_token` vem com `Secure` e `SameSite=None`.
- Em Settings → Cron Jobs aparece `/api/v1/health`, uma vez por dia. É isso que evita a pausa do Supabase, que ocorre após 7 dias sem atividade.

## 5. Conectar o front

Front e API em subdomínios diferentes de `vercel.app` contam como sites diferentes, e alguns navegadores bloqueiam o cookie de refresh nesse caso. Para evitar isso, faça o projeto do front repassar as chamadas para a API, com este `vercel.json` no front:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<sua-api>.vercel.app/api/:path*"
    }
  ]
}
```

O front então chama `/api/v1/...` no próprio domínio, e o navegador vê um site só. Nesse modelo o `CORS_ORIGINS` não é necessário para o site em produção, mas continua útil para o front rodando localmente.

Para publicar o front:

1. Na Vercel, crie um projeto novo a partir deste repositório, com **Root Directory** `apps/web` e **Framework Preset** `Vite`. O build e a pasta de saída (`dist`) são detectados sozinhos.
2. Confira que o `destination` do rewrite em `apps/web/vercel.json` aponta para o endereço da API (`https://<sua-api>.vercel.app/api/:path*`). Quando a API mudar de endereço, troque o `destination` aí e atualize o teste `vercel-config.test.ts`, que confere esse valor.
3. Depois do deploy, abra a URL publicada e confira: login, recarregar uma rota interna e sair. Esse é o único teste do rewrite real da Vercel.

Localmente, o `npm run dev` repassa `/api` para `http://localhost:3000`. Se a API estiver em outra porta, defina `VITE_API_TARGET` (por exemplo, `VITE_API_TARGET=http://localhost:3010 npm run dev`).

## 6. Limite de requisições e `TRUST_PROXY`

A API limita tentativas por IP: login 10 por minuto e cadastro (`POST /api/v1/auth/register`) 5 por minuto, com resposta 429 ao passar disso. Atrás da Vercel, e do rewrite do front, todas as requisições chegam de proxies. Sem `TRUST_PROXY`, a API enxergaria o IP do proxy e o limite viraria **global**: poucas pessoas bastariam para travar o login de todo mundo.

- **`TRUST_PROXY`** é o número de saltos de proxy confiáveis na frente da API. Sem a variável, nenhum proxy é confiado. Chamando a API direto pela URL dela, comece com `1`. Com a API chamada pelo rewrite do front, provavelmente são dois saltos (o do front e o da API), mas isso é uma suposição que ninguém verificou: trate `2` apenas como palpite inicial e confirme com as checagens abaixo. Um valor menor que o real faz a API ver o IP do proxy (limite global); um maior permite que o visitante forje o IP pelo cabeçalho `X-Forwarded-For` e escape do limite.
- **Depois do deploy, confira que o valor não está baixo demais** (limite global). Faça requisições a partir de duas redes ou aparelhos diferentes (por exemplo, o computador e o celular no 4G). Esgote o limite em um e confirme que o outro ainda consegue tentar. Supondo que os limites continuem em 5 (cadastro) e 10 (login) e que as tentativas aconteçam dentro de um minuto, 6 cadastros ou 11 logins seguidos com dados inválidos devem dar 429. Se os dois forem bloqueados juntos, o valor está baixo demais.
- **Confira também que o valor não está alto demais.** Essa falha é silenciosa: o teste das duas redes passa e o limite parece funcionar, mas qualquer pessoa escapa dele enviando um `X-Forwarded-For` forjado. A API é acessível pelo rewrite do front (dois ou mais saltos) e direto pela URL dela na Vercel (um salto), então um valor ajustado para o rewrite sobra um salto na URL direta. Se isso importa depende de a Vercel sobrescrever ou acrescentar o `X-Forwarded-For`, o que não foi verificado. Rode o teste de falsificação contra a URL direta da API **e** contra a URL do front, trocando `<URL>` por cada uma:

  ```bash
  for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST <URL>/api/v1/auth/login -H 'Content-Type: application/json' -H "X-Forwarded-For: 203.0.113.$i" -d '{"email":"x@x.test","password":"x"}'; done
  ```

  A 11ª resposta deve ser 429. Se não for, o valor está alto demais ou o cabeçalho forjado está sendo repassado. Espere um minuto entre uma URL e outra para o limite zerar.
- **Se nenhum valor único passar na checagem das duas redes e nas duas de falsificação, o IP do cliente precisa vir de outra fonte.** Isso é uma mudança de código, não de configuração.
- Refresh, `me`, logout e `/health` nunca respondem 429; só login e cadastro têm limite. Isso ajuda na checagem pós-deploy: um 429 só pode vir dessas duas rotas.
- **`THROTTLE_DISABLED=true` serve só para testes** (o job `web` do CI usa para os testes e2e no navegador). Nunca defina essa variável na Vercel: em produção o limite fica ligado por padrão.

## 7. Cadastro público

O `POST /api/v1/auth/register` cria uma conta de cliente e já abre a sessão. Esta entrega **não adicionou migration** (conferido em `apps/api/prisma/migrations`): basta publicar a nova versão da API, sem mudança no banco. Contas criadas ali aparecem no banco de produção, que é de demonstração e pode ser limpo periodicamente.

## Limitações conhecidas

- **Certificado do banco:** a conexão é criptografada, mas o certificado do servidor não é validado. Para validar, seria preciso incluir o certificado CA do Supabase no projeto.
- **Cold start:** a função é desligada quando fica sem uso, e a primeira requisição depois disso demora mais.
