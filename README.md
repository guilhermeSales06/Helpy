# Helpy

Sistema de chamados (helpdesk), reescrito a partir de um projeto acadêmico em Python.

| Pasta | O que é |
| --- | --- |
| [`apps/api`](apps/api) | API REST em NestJS, Prisma e PostgreSQL. Veja o README dela para rodar. |
| `apps/web` | Front-end em React + Vite. |
| [`legacy`](legacy) | Código original em Python. |
| [`docs`](docs) | Documentação, como o [guia de deploy](docs/DEPLOY.md). |

Cada app tem seu próprio `package.json` e é instalado separadamente: `cd apps/<app> && npm install`.
