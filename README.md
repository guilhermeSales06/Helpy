# Helpy API

[![CI](https://github.com/guilhermeSales06/Helpy/actions/workflows/ci.yml/badge.svg)](https://github.com/guilhermeSales06/Helpy/actions/workflows/ci.yml)

API REST de um sistema de chamados (helpdesk), reescrita em NestJS a partir de um projeto acadêmico em Python. O código original está em [`legacy/`](legacy/).

> Em desenvolvimento. Já disponíveis: autenticação, permissões por perfil, gestão de usuários, áreas, categorias e chamados. Comentários, histórico e métricas vêm a seguir.

## Stack

NestJS, TypeScript, PostgreSQL e Prisma.

## Como rodar

Requer Node 26 e Docker.

```bash
npm install
cp .env.example .env
```

No `.env`, troque `JWT_ACCESS_SECRET` e `SEED_ADMIN_PASSWORD`. Depois:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Documentação (Swagger): `http://localhost:3000/docs`
- Contrato OpenAPI em JSON: `http://localhost:3000/docs-json`

Para publicar, siga o [guia de deploy](docs/DEPLOY.md).

## Autenticação para o front-end

1. `POST /api/v1/auth/login` devolve o `accessToken` e grava o refresh token em um cookie httpOnly.
2. Envie o access token em cada requisição: `Authorization: Bearer <token>`. Ele expira em 15 minutos.
3. Ao receber 401, chame `POST /api/v1/auth/refresh` para obter um novo token. Se o refresh também devolver 401, mande o usuário para o login.

Dois cuidados:

- **Envie os cookies:** use `credentials: 'include'` (fetch) ou `withCredentials: true` (axios) nas rotas de `/auth`. A origem do front precisa estar em `CORS_ORIGINS`.
- **Faça um refresh por vez:** cada refresh token só vale uma vez, e reutilizá-lo encerra todas as sessões do usuário. Se várias requisições receberem 401 juntas, elas devem aguardar o mesmo refresh.

## Perfis

| Perfil | Como é criado | Gestão de usuários (`/users`) |
| --- | --- | --- |
| `ADMIN` | Pelo seed | Sim |
| `TECHNICIAN` | Por um admin | Não |
| `CLIENT` | Por um admin | Não |

Usuários são desativados em vez de apagados, para preservar o histórico. A desativação bloqueia o login e o refresh na hora. Um access token já emitido pode continuar válido por até 15 minutos.

## Chamados

Cada área agrupa categorias (ex.: Hardware → Impressora), e cada técnico atende uma ou mais áreas.

| Perfil | Quais chamados vê |
| --- | --- |
| `CLIENT` | Os próprios |
| `TECHNICIAN` | Os atribuídos a ele e os sem técnico das suas áreas |
| `ADMIN` | Todos |

Um chamado que o usuário não pode ver responde 404, como se não existisse.

**Quem faz o quê**

- **Abrir:** cliente.
- **Atribuir ou reatribuir técnico:** admin. Só com o chamado em `OPEN` ou `IN_PROGRESS`.
- **Mudar prioridade:** admin ou técnico atribuído. Não vale para chamados `CLOSED`.

**Mudança de status**

| De | Para | Quem pode |
| --- | --- | --- |
| `OPEN` | `IN_PROGRESS` | Técnico atribuído, admin (exige técnico no chamado) |
| `IN_PROGRESS` | `RESOLVED` | Técnico atribuído, admin |
| `RESOLVED` | `CLOSED` | Cliente, admin |
| `RESOLVED` | `IN_PROGRESS` (reabrir) | Cliente, técnico atribuído, admin |

`CLOSED` é definitivo. Qualquer outra mudança responde 409, e 409 também indica que outra pessoa alterou o chamado ao mesmo tempo: recarregue e tente de novo.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run db:up` / `db:down` | Sobe ou derruba o Postgres local |
| `npm run db:migrate` | Cria e aplica migrations em desenvolvimento |
| `npm run db:deploy` | Aplica migrations em produção |
| `npm run db:seed` | Cria o primeiro admin, sem alterar um que já exista |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes e2e, em um banco próprio (`helpy_test`), com o Postgres local no ar |
| `npm run lint` | Lint com oxlint |
| `npm run typecheck` | Checa os tipos, incluindo os testes |
| `npm run format:check` | Confere a formatação com Prettier |
