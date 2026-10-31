# Helpy API

API REST de um sistema de chamados (helpdesk), reescrita em NestJS a partir de um projeto acadêmico em Python. O código original está em [`legacy/`](legacy/).

> Em desenvolvimento. Por enquanto, a API expõe apenas o endpoint de health.

## Stack

NestJS, TypeScript, PostgreSQL e Prisma.

## Como rodar

Requer Node 26 (ou `^22.22.3` / `^24.15`) e Docker.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run start:dev
```

A API sobe em `http://localhost:3000/api/v1`. Para conferir, acesse `/api/v1/health`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run db:up` / `db:down` | Sobe ou derruba o Postgres local |
| `npm run db:migrate` | Cria e aplica migrations em desenvolvimento |
| `npm run db:deploy` | Aplica migrations em produção |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes e2e (requer o Postgres local) |
| `npm run lint` | Lint com oxlint |
