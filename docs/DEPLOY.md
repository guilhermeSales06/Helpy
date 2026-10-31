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

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório. O framework **NestJS** é detectado sozinho: não altere os comandos de build.
2. Confirme que a **Production Branch** é a `main`.
3. Em **Environment Variables**, adicione estas variáveis **apenas no ambiente Production**:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Do passo anterior |
| `DIRECT_URL` | Do passo anterior |
| `JWT_ACCESS_SECRET` | Gere com o comando abaixo |
| `CORS_ORIGINS` | URL do front, ou deixe vazio se usar o rewrite descrito abaixo |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

4. Faça o deploy. O build de produção aplica as migrations antes de publicar. Se elas falharem, o deploy falha e a versão anterior continua no ar.

Deploys de preview não têm banco, de propósito, para nunca alterar os dados de produção. Eles terminam o build, mas não respondem às rotas.

## 3. Criar o primeiro admin

Rode no seu computador, uma única vez. Use uma senha forte, que você não usa em outro lugar. As variáveis valem só para esta janela do terminal e têm prioridade sobre o `.env`.

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

## Limitações conhecidas

- **Certificado do banco:** a conexão é criptografada, mas o certificado do servidor não é validado. Para validar, seria preciso incluir o certificado CA do Supabase no projeto.
- **Cold start:** a função é desligada quando fica sem uso, e a primeira requisição depois disso demora mais.
