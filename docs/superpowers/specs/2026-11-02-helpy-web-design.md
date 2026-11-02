# Helpy: front-end e evolução da API

Data: 2026-11-02
Responsável: Guilherme Sales. As mudanças na API também ficam com ele, de acordo com o Rafael, que criou a API.

## Intenção

O Helpy é um sistema de chamados (helpdesk) que nasceu como projeto de POO em Python e foi reescrito em NestJS. Agora ganha o front-end, construído a partir de um design próprio feito no Claude Design.

É um projeto de **portfólio**, e a meta é deixá-lo o mais completo possível. Quem avalia é recrutador ou outro dev, que precisa ver o sistema funcionando em segundos e também vai ler o código e o histórico de commits.

## Objetivos

- Front-end em `apps/web`, fiel ao visual do design, para os perfis cliente, técnico e admin.
- API evoluída onde o design pede mais do que ela oferece.
- Histórico organizado: commits pequenos, um por ajuste, separados por parte.
- Cada fatia entregue fica utilizável e testada.

## Fora do escopo

- Login com Google ou Apple. O Guilherme descartou Google. Apple é decisão minha, para manter um só método de login. Os dois botões saem das telas.
- Vários clientes separados na mesma instalação (multi-tenant) e cobrança.

Ficam para depois, porque ninguém pediu (decisão minha):

- "Esqueci minha senha" e envio de e-mail, que exigem um serviço de e-mail. O link sai da tela de login.
- Anexos, que exigem armazenamento de arquivos. O campo e o botão saem das telas.
- WebSocket e tempo real de verdade (veja "Atualização periódica").
- Itens do design que ficam de fora: presença do técnico (Disponível/Ausente), respostas prontas, canal de origem (e-mail, telefone), "Equipe agora", excluir chamados em massa, "Preferências" e "Configurações". Atribuir e resolver em massa ficam a cargo do construtor, se couberem na listagem.
- Trocar a categoria de um chamado. Ela aparece só como leitura.

## O que seria um fracasso

- Nota interna do técnico aparecendo para o cliente, inclusive na resposta da API.
- Permissão garantida só pelo front.
- Visual genérico de template, longe do design.
- Um PR enorme e sem histórico legível.
- Demo que exige criar conta para ver qualquer coisa.

## Referência visual

O design está em `Helpy — Design de helpdesk.zip`, na pasta acima do repo, fora do Git. A referência é o **`Helpy v2.dc.html`**, por ser o mais recente (decisão minha).

- Telas: login, cadastro, visão geral, listagem, chamado e novo chamado.
- Ilustrações: `assets/ilustra-login.png` e `assets/ilustra-cadastro.png`, que devem ser copiadas para `apps/web`.
- Fontes: Figtree (texto) e Space Grotesk (títulos).
- Cores principais: laranja `#FE6F00`, texto `#1C1A18`, fundo `#F7F6F4` e `#FAF9F7`, bordas `#ECE8E4` e `#E2DDD8`.
- O HTML serve só de referência. Ele depende do `support.js` do Claude Design e não deve ser reaproveitado como código. As telas são recriadas, mantendo cores, textos, espaçamentos e ilustrações.

## Stack (proposta por mim, aprovada pelo Guilherme)

| Parte | Escolha |
| --- | --- |
| Base | React, TypeScript, Vite |
| Rotas | TanStack Router, com filtros da fila na URL |
| Dados da API | TanStack Query |
| Contrato com a API | `openapi-typescript` e `openapi-fetch`, com tipos gerados do `/docs-json` |
| Visual | Tailwind, com as cores e fontes do design como tokens |
| Componentes | Radix por baixo, visual próprio |
| Formulários | React Hook Form e Zod |
| Gráficos | Recharts |
| Testes | Vitest, Testing Library, Playwright |
| Qualidade | oxlint e Prettier, como na API |

Versões são conferidas na instalação. O repo é um monorepo sem npm workspaces: cada app tem seu próprio `package.json`.

## Arquitetura do front

```
apps/web/src/
├── app/        inicialização, providers, rotas
├── features/   auth, tickets, conversation, notifications, dashboard, admin
├── shared/ui/  botões, inputs, badges, modais
├── shared/api/ cliente HTTP, refresh, tipos gerados
└── shared/lib/ datas, formatação de SLA
```

Um app só para os três perfis, com a mesma tela de login e o mesmo layout. Menu e ações mudam por perfil. O front só esconde o que a pessoa não pode usar. Quem garante a permissão é a API.

### Autenticação

Conforme o README da API: access token em memória, refresh em cookie httpOnly e `credentials: 'include'`. **Só um refresh por vez**: cada refresh token vale uma vez e reutilizá-lo encerra todas as sessões, então requisições que recebem 401 juntas aguardam o mesmo refresh. Ao recarregar a página, o front tenta um refresh antes de mandar para o login.

### Mesmo domínio

O front repassa `/api` para a API, como o `docs/DEPLOY.md` orienta, para o cookie de refresh não ser bloqueado. No desenvolvimento, o proxy do Vite faz o mesmo papel.

### Atualização periódica

A API roda em funções da Vercel, que não mantêm conexão aberta. Conversa e notificações se atualizam por consultas periódicas com TanStack Query. O construtor escolhe os intervalos, parando quando a aba do navegador está em segundo plano.

### Abas de chamados

A faixa de abas do design vale para todos os perfis. Cada chamado aberto vira uma aba, guardada no navegador da pessoa (decisão minha), sem mudança na API. O limite de abas fica a cargo do construtor.

## Telas por perfil

### Cliente (aprovado pelo Guilherme em mockup)

- **Layout:** menu lateral, cabeçalho com busca, "Novo chamado", sino e perfil, iguais aos do técnico, e faixa de abas.
- **Início:** a lista dos chamados dele, agrupada em **Precisa de você**, **Com o suporte** e **Encerrados**. O grupo "Precisa de você" traz chamados `RESOLVED`, com "Confirmar" e "Ainda com problema", e chamados `PENDING`, que aguardam resposta dele.
- **Sem botão repetido:** "Novo chamado" fica só no cabeçalho.
- **Chamado:** mesmo visual de conversa do técnico, só com "Responder". Sem modo de nota, sem SLA e sem prioridade (decisão minha).
- **Aba:** mostra o assunto e o técnico, em vez do solicitante.
- **Busca:** só nos próprios chamados.

### Técnico

Como no design: visão geral, listagem com filtros, chamado com conversa e notas internas, novo chamado. Pode abrir chamado em nome de um cliente e assumir chamados da fila das áreas dele.

A visão geral tem uma alternância **Minha visão / Equipe**, para as métricas (decisão do Guilherme). Ver os chamados continua limitado às regras atuais da API, com os atribuídos a ele e a fila das áreas dele. A alternância mostra números agregados, sem abrir os chamados dos colegas (decisão minha). "Todos os chamados" e o filtro por colega do design só aparecem para o admin.

### Admin

Vê todos os chamados e distribui o trabalho, mas não atende: não tem "Atribuir a mim" nem "Meus chamados" (decisão do Guilherme). Tem também telas de **usuários, áreas e categorias**. Essas telas não existem no design e seguem o mesmo visual (decisão minha, para o projeto ficar completo).

### Todos os perfis

"Meu perfil" é uma tela real, para mudar nome e senha (decisão minha).

## Mudanças na API

Seguem os módulos existentes do Nest. Cada mudança de banco é uma migration própria, e cada regra nova tem teste e2e. Depois de cada mudança, o front regenera os tipos.

| Área | O que muda |
| --- | --- |
| Cadastro | `POST /auth/register` público, sempre cria `CLIENT`. Técnico e admin continuam criados como hoje. |
| Limite de tentativas | A API não tem hoje. Entra em login e cadastro, porque a demo fica pública. |
| Abrir chamado | `POST /tickets` aceita também técnico e admin, que informam o cliente (`clientId`). Cliente continua abrindo só para si e não escolhe prioridade: começa em Média, e técnico ou admin ajustam (decisão minha, para não distorcer o SLA). Responsável é opcional, e atribuir a outro técnico segue a regra atual (só admin). |
| Assumir chamado | Técnico assume chamado sem responsável das áreas dele, o que já muda o status para `IN_PROGRESS`. Técnico devolve à fila um chamado dele. Só admin passa para outro técnico. Admin não pode ser responsável (decisão do Guilherme). |
| Perfil | Rotas para a própria pessoa mudar nome e senha, fora de `/users`, que é só para admin. |
| Status | Novo `PENDING`, "aguardando o solicitante". Veja abaixo. |
| Número do chamado | O design usa `#4821` e o `id` é UUID. Novo campo numérico sequencial, usado na tela, na busca e nas abas. |
| Busca | Filtro de texto em título e número em `GET /tickets`, respeitando o que cada perfil pode ver. |
| Conversa | Rotas de comentários e histórico, usando os modelos `Comment` e `TicketEvent`, que já existem. Comentário gera evento `COMMENTED`. Regras abaixo. |
| Notas internas | `Comment.internal` já existe. **O servidor nunca devolve nota interna ao cliente.** Cliente não pode criar nota. |
| Notificações | Novo modelo, listagem e marcar como lidas. Veja abaixo. |
| SLA | Veja abaixo. |
| Métricas | Rota de resumo para a visão geral, com escopo pessoal ou de equipe. Técnico e admin veem os dois, e cliente não vê. A visão de equipe é uma exceção deliberada à regra de visibilidade: traz só números agregados e nomes de técnicos, sem dados de chamados nem de clientes. |
| Demo | Contas de demonstração e dados de exemplo. Veja abaixo. |

### Status

| De | Para | Quem pode |
| --- | --- | --- |
| `OPEN` | `IN_PROGRESS` | Técnico atribuído, admin (como hoje) |
| `IN_PROGRESS` | `PENDING` | Técnico atribuído, admin |
| `PENDING` | `IN_PROGRESS` | Técnico atribuído, admin. Também automático quando o cliente responde (decisão minha) |
| `IN_PROGRESS` | `RESOLVED` | Técnico atribuído, admin (como hoje) |
| `RESOLVED` | `CLOSED` | Cliente, admin (como hoje) |
| `RESOLVED` | `IN_PROGRESS` | Cliente, técnico atribuído, admin (como hoje) |

Assumir também leva `OPEN` para `IN_PROGRESS`. Devolver à fila leva o chamado para `OPEN`, sem responsável.

Regras da conversa (decisões minhas):

- Cliente responder em `RESOLVED` reabre para `IN_PROGRESS` e limpa `resolvedAt`, como o design promete.
- `CLOSED` não aceita novos comentários.
- Técnico precisa assumir o chamado antes de responder ou criar nota. Admin não precisa.

`CLOSED` continua definitivo, porque o cliente confirma a solução. A tela ganha `Fechado`, que o design não tem. Cor sugerida: `#57524D` sobre `#F5F3F1`. `Pendente` usa `#5E45A3` sobre `#F3F0FA`, como no design.

Prioridades na tela: `LOW` = Baixa, `NORMAL` = Média, `HIGH` = Alta, `URGENT` = Urgente.

### Notificações

Sem e-mail, entregues pelo sino. O cliente é avisado quando o técnico responde (sem contar notas internas), assume o chamado ou muda o status. O técnico é avisado de novas mensagens nos chamados dele e de chamados atribuídos a ele. Os eventos exatos de técnico e admin ficam a cargo do construtor. Quem fez a ação não é notificado.

### SLA e métricas

SLA aqui significa **tempo até resolver** (decisão minha), medido de `createdAt` até `resolvedAt`, com os prazos do design: Urgente 1 h, Alta 4 h, Média 8 h, Baixa 24 h. Tempo corrido, sem horário comercial. Reabrir volta a contar a partir da criação. O tempo em `PENDING` não é descontado (decisão minha, para manter simples). A API calcula o prazo e devolve o estado: no prazo, perto do fim, em atraso ou cumprido.

Visão geral: abertos, atribuídos a mim, pendentes, primeira resposta média, % de SLA cumprido nos últimos 30 dias, volume dos últimos 7 dias e carga por técnico. Os números vêm de dados reais. Variações comparativas e metas do design, como "−4 min", só entram se tiverem cálculo real. Nada de número fixo na tela.

### Demo

**O ambiente publicado é só demo** (decisão do Guilherme). Não há contas nem dados reais nele.

- Na tela de login, entrada rápida como cliente, técnico ou admin, com dados de exemplo.
- Uma rotina protegida apaga tudo e recria os dados de tempos em tempos.
- O cadastro funciona, e a tela avisa que os dados são públicos e apagados periodicamente, porque o admin demo vê nome e e-mail de quem se cadastrou.
- Contas de demonstração não podem mudar senha nem nome, e o admin demo não pode desativar os outros acessos de demonstração.
- A rotina nunca roda sem estar explicitamente ativada por variável de ambiente, para não apagar dados em outro ambiente. O detalhe da proteção fica a cargo do construtor.

## Ordem de entrega

Cada fatia tem API e tela juntas, em uma branch e uma PR.

1. **Base do front e login:** projeto, tokens, layout, autenticação, CI do front, deploy do front.
2. **Cadastro:** registro público e limite de tentativas.
3. **Chamados do técnico:** listagem, detalhe, `PENDING`, número, busca, assumir e devolver à fila.
4. **Abertura de chamado:** por cliente e atendente.
5. **Conversa e histórico:** comentários, notas internas e abas.
6. **Visão do cliente:** tela agrupada e confirmação da solução.
7. **Notificações.**
8. **Telas de admin e perfil:** usuários, áreas, categorias e "Meu perfil".
9. **SLA e métricas:** visão geral, com a alternância Minha visão / Equipe.
10. **Demo:** contas, dados de exemplo e rotina de recriação.

## Forma de trabalhar

- Commits pequenos, um por ajuste, no formato do repo (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Uma branch e uma PR por fatia, com CI passando antes do merge.
- O CI ganha um job para `apps/web`.
- Testes e2e na API para cada regra nova. Playwright para os fluxos principais de cada perfil.

## Deploy

- Novo projeto na Vercel para o front, com Root Directory `apps/web`.
- **API (decisão do Guilherme):** ligar a Vercel direto em `guilhermeSales06/Helpy`, com Root Directory `apps/api`, de preferência num projeto na conta do Guilherme. Hoje a API publicada (`helpy-lilac.vercel.app`) está ligada ao fork `Rafaelgs2/Helpy`. O banco será um **projeto novo no Supabase, na conta do Guilherme**, sem migrar dados do projeto atual, já que produção é só demo. Isso precisa de uma ação manual do Guilherme na Vercel e no Supabase, com as variáveis listadas em `docs/DEPLOY.md`. Até lá, as fatias funcionam só no local, sem bloquear o desenvolvimento.
- Migrations rodam no build de produção (`vercel-build`). Por isso, cada migration precisa ser segura de aplicar em produção. O `PENDING` e o número sequencial precisam funcionar com chamados que já existem.

## A cargo do construtor

- Detalhes internos de componentes e nomes de rotas e arquivos.
- Formato exato das rotas novas da API, seguindo o padrão atual.
- Intervalos de atualização, limite de abas, tamanho das páginas.
- Valores do limite de tentativas.
- Comportamento responsivo e em celular, seguindo o que o design já faz.
