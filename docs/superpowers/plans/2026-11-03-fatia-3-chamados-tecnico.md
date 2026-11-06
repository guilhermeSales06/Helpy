# Fatia 3: chamados do técnico e do admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Técnico e admin veem a lista de chamados com filtros, busca e ordenação, abrem o detalhe e agem sobre ele (assumir, devolver à fila, pendente, resolver, prioridade, atribuir), com o novo status `PENDING` e o número sequencial do chamado.

**Architecture:** A API ganha duas migrations (enum `PENDING`, coluna `number`), busca/ordenação/contagens no `GET /tickets` e os endpoints `take` e `release`. O front ganha `/chamados` (lista com filtros na URL) e `/chamados/$ticketId` (detalhe com ações por perfil), usando TanStack Query e os tipos gerados da API.

**Tech Stack:** NestJS 12, Prisma (PostgreSQL), Vitest + Supertest (API); React, TanStack Router + Query, Zod, Tailwind, Playwright (web).

**Spec:** `docs/superpowers/specs/2026-11-02-helpy-web-design.md` (seções "Mudanças na API → Abrir chamado/Assumir chamado/Status/Número do chamado/Busca", "Telas por perfil → Técnico/Admin", ordem das fatias, item 3).

## Global Constraints

- Quem vê o quê não muda (regra da API): CLIENT só os próprios; TECHNICIAN os atribuídos a ele e a fila sem técnico das áreas dele; ADMIN todos. **Busca, ordenação e contagens passam pelo mesmo filtro de visibilidade** (`visibleTo`). Um chamado que a pessoa não pode ver responde 404.
- O admin **não atende**: não assume nem devolve chamado, não tem "Meus chamados". Só o técnico assume e devolve.
- Status novo `PENDING` ("aguardando o solicitante"), anexado **no fim** do enum `TicketStatus` no `schema.prisma` (para a migration ser um `ALTER TYPE ... ADD VALUE` simples). Transições: as atuais, mais `IN_PROGRESS → PENDING` e `PENDING → IN_PROGRESS`, ambas só para técnico atribuído ou admin. `PENDING` não vai direto para `RESOLVED`. `CLOSED` continua definitivo. A volta automática `PENDING → IN_PROGRESS` quando o cliente responde é da fatia 5, não desta.
- Número do chamado: coluna `number Int @unique @default(autoincrement())` em `Ticket`; chamados já existentes recebem número na migration (sem quebrar dados). Na tela aparece como `#<número>`. O `id` UUID continua sendo a chave das rotas e das ações.
- Assumir: `PATCH /api/v1/tickets/:id/take`, só TECHNICIAN, só chamado `OPEN` sem técnico visível a ele (fila das áreas dele); grava técnico = ele e status `IN_PROGRESS` numa transação, com os eventos `ASSIGNED` e `STATUS_CHANGED`. Já assumido por outro (inclusive em disputa simultânea) → **409**, nunca dois técnicos. Fora da fila dele → 404 (mesma resposta de "não existe"). Admin/cliente → 403.
- Devolver: `PATCH /api/v1/tickets/:id/release`, só o TECHNICIAN atribuído ao chamado, em `IN_PROGRESS` ou `PENDING` (não em `OPEN`, `RESOLVED`, `CLOSED` → 409); remove o técnico e volta o status para `OPEN`, numa transação, com os eventos `ASSIGNED` (de ele para nulo) e `STATUS_CHANGED`. Outro técnico → 403.
- Busca: parâmetro `q` em `GET /api/v1/tickets` (máx. 100 caracteres, após `trim`; vazio = sem busca). Acha o chamado cujo título contém o texto (sem diferenciar maiúsculas) **ou**, se `q` for só dígitos com `#` opcional (`#4821` ou `4821`), cujo número é igual. `%`, `_` e `\` valem como texto literal. Número acima do limite de `Int` não quebra: simplesmente não acha nada.
- Ordenação: parâmetro `sort` = `newest` (padrão, o comportamento atual), `updated` (atualizados recentemente), `oldest`, `priority` (maior prioridade primeiro, depois o mais antigo). Todas com desempate por `id` para a paginação ficar estável.
- Contagens: `GET /api/v1/tickets/counts` aceita os mesmos filtros da lista **menos** `status`, `sort`, `page` e `limit`, e devolve `{ total: number; byStatus: { OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED: number } }`.
- A resposta de chamado ganha `number` e o `client` passa a trazer `email` além de `id` e `name`.
- Front: textos em português. Status: Aberto `#2457A8` sobre `#EEF3FB`, Em andamento `#8A5300` sobre `#FBF2E2`, Pendente `#5E45A3` sobre `#F3F0FA`, Resolvido `#22704A` sobre `#EAF4EE`, Fechado `#57524D` sobre `#F5F3F1`. Prioridades: `LOW` Baixa, `NORMAL` Média, `HIGH` Alta, `URGENT` Urgente. Visual da lista e do detalhe: `Helpy v2.dc.html`, telas `04 Listagem` (linhas ~290-420) e `05 Chamado` (linhas ~421-560), em `/tmp/claude-1000/-home-guilhermeas-dev-PROJETOS-helpy-Helpy/6a90f213-27b7-4191-9335-f35aa3f4b355/scratchpad/design/` (se a pasta não existir, extrair o `Helpy — Design de helpdesk.zip` da pasta acima do repo para lá, nunca para dentro do repo).
- Filtros da fila ficam na URL de `/chamados` (compartilhável, sobrevive a recarregar). Chaves e valores: `status` (um valor de `TicketStatus`), `priority` (um valor de `TicketPriority`), `category` (uuid), `assignee` (`me`, `none` ou, só para admin, o uuid de um técnico), `q`, `sort` (os quatro valores acima), `page` (inteiro ≥ 1). Valores inválidos na URL **nunca quebram a tela**: caem no padrão.
- Menu lateral: TECHNICIAN → "Visão geral" (`/`), "Meus chamados" (`/chamados?assignee=me`), "Não atribuídos" (`/chamados?assignee=none`). ADMIN → "Visão geral", "Todos os chamados" (`/chamados`), "Não atribuídos" (`/chamados?assignee=none`). CLIENT continua como está (a tela do cliente é a fatia 6). "Visão geral" segue como a página inicial atual.
- Fora desta fatia (YAGNI): seleção em massa e ações em lote, abas de chamados abertos, conversa/histórico (fatia 5), SLA e métricas (fatia 9), abrir chamado (fatia 4), tela do cliente (fatia 6).
- Convenção de nomes: branch `feat/chamados-tecnico`; commits `tipo(escopo): assunto`, escopo `api`, `web`, `docs` ou `ci`, minúsculas, imperativo, ~60 caracteres. Commits pequenos, um por ajuste, nenhum que dependa de commit posterior. Não fazer push.

## Review Focus

1. Dois técnicos assumem o mesmo chamado ao mesmo tempo: um 200, o outro 409, e o banco termina com um único técnico (Task 3).
2. Assumir fora da fila do técnico, chamado que já tem técnico, chamado que não está `OPEN`, e por admin/cliente: 404/409/409/403 e nada muda no banco (Task 3).
3. Devolver por outro técnico = 403; em `OPEN`/`RESOLVED`/`CLOSED` = 409 (Task 3).
4. Busca com `%`, `_`, `\`, `#12`, `0`, `99999999999`, espaços e 101 caracteres: nenhum erro 500; os curingas valem como texto; acima de 100 caracteres = 400 (Task 2).
5. Busca, ordenação e contagens nunca revelam chamado fora do escopo da pessoa: técnico sem a área não encontra o chamado nem por número, e as contagens não incluem o que ele não vê (Task 2).
6. Chamados que já existiam antes da migration ganham número único e a numeração segue a partir do maior (Task 1).
7. Front: `?status=XYZ&page=-3&sort=foo&assignee=` não quebra a lista; um chamado inexistente ou fora do escopo mostra uma página de "não encontrado" amigável; uma ação que dá 409 (outra pessoa mexeu antes) mostra a mensagem e recarrega o chamado; clicar duas vezes em "Assumir" envia um pedido só; só aparecem os botões que o perfil e o status permitem (Tasks 5, 6).

---

### Task 1: Migrations (`PENDING`, `number`) e transições de status

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/src/tickets/ticket-status.ts`, `apps/api/src/tickets/ticket-status.spec.ts`, `apps/api/src/tickets/dto/ticket-response.dto.ts`, `apps/api/src/tickets/tickets.service.ts` (o `ticketSelect`), `apps/api/src/tickets/tickets.controller.ts` (descrição da transição)
- Create: `apps/api/prisma/migrations/<timestamp>_add_ticket_pending_status/migration.sql`, `apps/api/prisma/migrations/<timestamp>_add_ticket_number/migration.sql`
- Test: `apps/api/src/tickets/ticket-status.spec.ts`, `apps/api/test/tickets.e2e-spec.ts` (casos novos)

**Interfaces:**
- Produces: `TicketStatus.PENDING`; `TicketResponseDto` com `number: number` e `client: { id: string; name: string; email: string }` (novo `TicketClientDto`); `checkTransition(from, to, role)` conhece as duas transições novas.

- [ ] **Step 1: Escrever os testes**

`ticket-status.spec.ts` (unitário, no estilo do arquivo):
```ts
it('lets a technician or admin move IN_PROGRESS to PENDING and back', ...);
it('does not let a client move IN_PROGRESS to PENDING', ...);                 // 'forbidden'
it('does not allow PENDING to RESOLVED, CLOSED or OPEN', ...);                // 'invalid'
```
`tickets.e2e-spec.ts` (e2e, no estilo do arquivo):
```ts
it('moves an assigned ticket to PENDING and back to IN_PROGRESS, recording STATUS_CHANGED events', ...);
it('forbids a client from marking a ticket PENDING', ...);
it('returns the ticket number and the client e-mail', ...);                   // number inteiro; client.email
it('gives increasing numbers to new tickets', ...);
```
O caso de chamados já existentes (Review Focus 6) é validado na Step 4.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npx vitest run src/tickets/ticket-status.spec.ts && npm run test:e2e -- tickets`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`schema.prisma`: acrescentar `PENDING` ao **fim** do enum `TicketStatus`; acrescentar `number Int @unique @default(autoincrement())` em `Ticket`. Gerar as migrations com `npx prisma migrate dev --create-only --name add_ticket_pending_status` e `--name add_ticket_number` (duas migrations, uma por mudança; a do enum antes), conferir o SQL (enum: só `ALTER TYPE "TicketStatus" ADD VALUE 'PENDING';`; número: coluna `SERIAL`/sequência com `UNIQUE`) e aplicar. `ticket-status.ts`: duas transições novas com papéis `[TECHNICIAN, ADMIN]`. DTO e `ticketSelect`: `number` e `client` com `email`. Atualizar o `@ApiOperation` de `status` com as novas transições.

- [ ] **Step 4: Verificar a migration com dados existentes**

Num banco local limpo: aplicar tudo **menos** a migration do número, inserir 3 chamados por SQL direto, aplicar a migration do número e conferir que os 3 ganharam `number` 1, 2, 3 distintos e que um novo chamado criado depois recebe 4. Registrar o comando e o resultado no relatório.

- [ ] **Step 5: Rodar tudo e fazer os commits**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
Expected: tudo passa.
```bash
git commit -m "feat(api): add pending ticket status"
git commit -m "feat(api): add sequential ticket number"
```

---

### Task 2: Busca, ordenação e contagens no `GET /tickets`

**Files:**
- Modify: `apps/api/src/tickets/dto/ticket-input.dto.ts`, `apps/api/src/tickets/dto/ticket-response.dto.ts`, `apps/api/src/tickets/tickets.service.ts`, `apps/api/src/tickets/tickets.controller.ts`
- Test: `apps/api/test/tickets-search.e2e-spec.ts`

**Interfaces:**
- Consumes: `number` e `PENDING` (Task 1).
- Produces: `ListTicketsQueryDto` ganha `q?: string` e `sort?: 'newest' | 'updated' | 'oldest' | 'priority'`; `TicketCountsQueryDto` (os mesmos filtros menos `status`, `sort`, `page`, `limit`); `GET /tickets/counts` → `TicketCountsResponseDto { total: number; byStatus: Record<TicketStatus, number> }`. Atenção: `counts` precisa ser registrada **antes** de `:id` para não ser lida como um UUID.

- [ ] **Step 1: Escrever os testes em `tickets-search.e2e-spec.ts`**

```ts
it('finds tickets by title, ignoring case', ...);
it('finds a ticket by number with or without #', ...);                        // "4821" e "#4821"
it('treats %, _ and \\ as literal text', ...);                                 // título "100% pronto" é achado por "%", e "a_b" não casa com "axb"
it('does not crash on 0, a huge number, spaces only, or an e-mail-looking text', ...);
it('rejects q longer than 100 characters with 400', ...);
it('never lets a technician find a ticket outside his scope, by title or by number', ...);
it('sorts by newest (default), updated, oldest and priority with a stable tie-break', ...);
it('priority sort puts URGENT first and older first inside the same priority', ...);
it('counts by status for the actor only', ...);                                // técnico não conta o que não vê
it('counts ignore the status filter but respect the other filters and q', ...);
it('counts is not read as a ticket id', ...);                                  // GET /tickets/counts não dá 400 de UUID
it('rejects an unknown sort with 400', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm run test:e2e -- tickets-search`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`q`: `@Transform(trim)`, `@IsOptional()`, `@IsString()`, `@MaxLength(100)`; no serviço, se vazio ignora; senão `OR [{ title: { contains: q, mode: 'insensitive' } }, ...(só dígitos com # opcional e dentro de Int → { number })]` dentro do `AND` junto com `visibleTo`. Confirmar com um teste que o `contains` do Prisma trata `%`/`_` como literais; se não tratar, escapar. `sort`: `@IsIn` dos quatro valores, mapeado para `orderBy` (sempre com `{ id: 'asc' }` por último; `priority` = `[{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }]` — a ordem do enum já vai de `LOW` a `URGENT`). Contagens: reaproveitar a montagem do `where` da lista sem `status`, e `groupBy status` (ou `count` por status) numa transação; devolver todos os status, com 0 onde não houver. Documentar no Swagger.

- [ ] **Step 4: Rodar e fazer os commits**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
Expected: tudo passa.
```bash
git commit -m "feat(api): search and sort tickets"
git commit -m "feat(api): count tickets by status"
```

---

### Task 3: Assumir e devolver à fila

**Files:**
- Modify: `apps/api/src/tickets/tickets.service.ts`, `apps/api/src/tickets/tickets.controller.ts`, `apps/api/src/tickets/dto/` (se precisar), `apps/api/README.md` (regras de assumir/devolver)
- Test: `apps/api/test/tickets-take-release.e2e-spec.ts`

**Interfaces:**
- Consumes: `applyChange` existente (estendê-lo, ou criar um irmão, para gravar **dois** eventos na mesma transação), `PENDING` (Task 1).
- Produces: `TicketsService.take(id: string, actor: AuthUser): Promise<SelectedTicket>`, `TicketsService.release(id: string, actor: AuthUser): Promise<SelectedTicket>`; rotas `PATCH /tickets/:id/take` e `PATCH /tickets/:id/release`, respostas `TicketResponseDto`.

- [ ] **Step 1: Escrever os testes em `tickets-take-release.e2e-spec.ts`**

```ts
it('lets a technician take an unassigned OPEN ticket of his area: technician set, IN_PROGRESS, two events', ...);
it('answers 404 when the ticket is outside the technician areas', ...);
it('answers 409 when the ticket already has a technician', ...);
it('answers 409 when the ticket is not OPEN', ...);
it('answers 409 to the second of two simultaneous takes and leaves exactly one technician', ...);   // Promise.all com dois técnicos
it('forbids admin and client from taking', ...);                                                    // 403
it('lets the assigned technician release an IN_PROGRESS or PENDING ticket: no technician, OPEN, two events', ...);
it('forbids another technician from releasing', ...);                                               // 403
it('answers 409 when releasing an OPEN, RESOLVED or CLOSED ticket', ...);
it('forbids admin and client from releasing', ...);
it('a released ticket can be taken by another technician of the area', ...);
it('the technician no longer sees a released ticket of an area he does not serve', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm run test:e2e -- tickets-take-release`
Expected: FAIL (404 das rotas).

- [ ] **Step 3: Implementar**

`take`: `findOne` (que já aplica `visibleTo`, logo fora da fila = 404), exigir role TECHNICIAN (`@Roles(Role.TECHNICIAN)` na rota), `ticket.technician` nulo e `status === OPEN`, senão 409; gravar `technicianId = actor.id`, `status = IN_PROGRESS` com a mesma guarda otimista do `applyChange` (só escreve se o chamado continua como foi lido), e os dois eventos (`ASSIGNED` de nulo para o técnico, `STATUS_CHANGED` de `OPEN` para `IN_PROGRESS`) na mesma transação. `release`: `@Roles(Role.TECHNICIAN)`, chamado atribuído ao ator (senão 403, como `assertAssignedIfTechnician`), status `IN_PROGRESS` ou `PENDING` (senão 409), grava `technicianId = null`, `status = OPEN`, `resolvedAt` inalterado (não existe nesses status), eventos `ASSIGNED` (do ator para nulo) e `STATUS_CHANGED` (do status atual para `OPEN`). Estender `applyChange` para aceitar uma lista de eventos mantendo as chamadas existentes funcionando. Atualizar `README.md` da API.

- [ ] **Step 4: Rodar e fazer os commits**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
Expected: tudo passa.
```bash
git commit -m "refactor(api): record several events per ticket change"
git commit -m "feat(api): let technicians take tickets from the queue"
git commit -m "feat(api): let technicians release tickets to the queue"
```

---

### Task 4: Base do front para chamados (tipos, modelo, menu, rotas)

**Files:**
- Modify: `apps/web/src/shared/api/schema.d.ts` (regenerado), `apps/web/src/app/nav-items.ts`, `apps/web/src/app/nav-items.test.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/app/router.test.tsx`
- Create: `apps/web/src/features/tickets/ticket-model.ts`, `apps/web/src/features/tickets/ticket-search.ts`, `apps/web/src/features/tickets/ticket-queries.ts`, `apps/web/src/features/tickets/status-badge.tsx`, `apps/web/src/features/tickets/priority-indicator.tsx`, `apps/web/src/shared/lib/format-date.ts`
- Test: `apps/web/src/features/tickets/ticket-model.test.ts`, `apps/web/src/features/tickets/ticket-search.test.ts`, `apps/web/src/shared/lib/format-date.test.ts`, `apps/web/src/features/tickets/status-badge.test.tsx`

**Interfaces:**
- Consumes: API das Tasks 1 a 3 (`/api/v1/tickets`, `/api/v1/tickets/counts`, `/api/v1/tickets/{id}`, `take`, `release`, `assign`, `status`, `priority`).
- Produces:
  - `ticket-model.ts`: `type Ticket = components['schemas']['TicketResponseDto']`, `type TicketStatus`, `type TicketPriority`, `STATUS_LABELS`/`STATUS_COLORS`, `PRIORITY_LABELS`, `formatNumber(n: number): string` (`#4821`), `allowedActions(ticket: Ticket, user: User): TicketAction[]` com `type TicketAction = 'take' | 'release' | 'pending' | 'resume' | 'resolve' | 'reopen' | 'assign' | 'changePriority'` (decide pelo perfil e pelo status conforme as regras de Global Constraints e as da API: técnico atribuído → `release`, `pending` em `IN_PROGRESS`, `resume` em `PENDING`, `resolve` em `IN_PROGRESS`, `reopen` em `RESOLVED`, `changePriority` fora de `CLOSED`; técnico vendo chamado da fila → `take` se `OPEN` sem técnico; admin → `assign` se `OPEN`/`IN_PROGRESS`/`PENDING`, `pending`/`resume`/`resolve`/`reopen`/`changePriority` nas mesmas condições; `CLOSED` sem nenhuma ação; admin nunca `take`/`release`).
  - `ticket-search.ts`: `type TicketSearch = { status?: TicketStatus; priority?: TicketPriority; category?: string; assignee?: string; q?: string; sort: Sort; page: number }`, `parseTicketSearch(raw: Record<string, unknown>): TicketSearch` (valores inválidos caem no padrão: `sort='newest'`, `page=1`, demais ausentes) e `toApiQuery(search: TicketSearch, me: string): ApiTicketQuery` (`assignee=me` vira `technicianId=<id do usuário>`, `none` vira `unassigned=true`, um uuid vira `technicianId`).
  - `ticket-queries.ts`: `ticketListQuery(search, me)`, `ticketCountsQuery(search, me)`, `ticketQuery(id)`, e mutações `useTakeTicket`, `useReleaseTicket`, `useChangeTicketStatus`, `useChangeTicketPriority`, `useAssignTicket` (todas invalidam lista, contagens e o chamado; todas devolvem o resultado `'ok' | 'conflict' | 'forbidden' | 'not-found' | 'unavailable'` para a tela mostrar a mensagem certa).
  - `<StatusBadge status />`, `<PriorityIndicator priority />`, `formatRelative(date: string | Date, now?: Date): string` (`agora`, `há 5 min`, `há 3 h`, `ontem`, `há 4 dias`) e `formatDateTime(date): string` (`22 out, 10:30`), como no design.
  - Rotas `/chamados` e `/chamados/$ticketId` dentro de `_app`, com `validateSearch` usando `parseTicketSearch`, e componentes provisórios (`TicketListPage`, `TicketDetailPage`) marcados como PLACEHOLDER para as Tasks 5 e 6. `navItemsFor` com os itens da seção Global Constraints.

- [ ] **Step 1: Regenerar os tipos**

Subir a API local numa porta livre (`PORT=3011`, por exemplo; a 3000 é de outro projeto), com Postgres e migrations aplicadas, e rodar `npx openapi-typescript http://localhost:<porta>/docs-json -o src/shared/api/schema.d.ts` em `apps/web`, sem alterar o script `gen:api`. Conferir `number`, `PENDING`, `/tickets/counts`, `take`, `release`, `q`, `sort`. Parar a API. Commit `chore(web): regenerate API types for tickets`.

- [ ] **Step 2: Escrever os testes**

```ts
// ticket-model.test.ts
it('formats the number as #4821', ...);
it.each(cases)('allowedActions: %s', ...);                    // tabela perfil x status x atribuição, cobrindo TODAS as combinações da definição acima
it('gives an admin no take or release, ever', ...);
it('gives nobody any action on a CLOSED ticket', ...);
// ticket-search.test.ts
it.each([['XYZ'], [''], [undefined], [42]])('falls back for an invalid status %j', ...);
it.each([['-3'], ['0'], ['abc'], ['1.5'], [''], [undefined]])('falls back to page 1 for %j', ...);
it('falls back to newest for an unknown sort', ...);
it('keeps a valid combination intact', ...);
it('trims q and drops an empty q; cuts q at 100 characters', ...);
it('toApiQuery maps me, none and a uuid', ...);
// format-date.test.ts
it.each(cases)('formatRelative', ...);                         // agora, minutos, horas, ontem, dias, futuro (relógio adiantado) = agora
it('formats the date and time like the design', ...);
// status-badge.test.tsx
it('shows the label and exposes the status to assistive tech', ...);
// nav-items.test.ts: itens por perfil (Global Constraints); router.test.tsx: /chamados exige login e preserva a busca; /chamados/<id> idem
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/features/tickets src/shared/lib src/app`
Expected: FAIL.

- [ ] **Step 4: Implementar**

Como descrito em Interfaces. As chaves de consulta do TanStack Query incluem os filtros e o id do usuário. Cores e rótulos vêm das Global Constraints. As mutações usam o cliente `api` com os caminhos completos do schema. Nada de componente de tela ainda além dos provisórios.

- [ ] **Step 5: Rodar e fazer os commits**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo passa.
```bash
git commit -m "feat(web): add ticket model, labels and allowed actions"
git commit -m "feat(web): parse ticket list filters from the URL"
git commit -m "feat(web): add ticket queries and mutations"
git commit -m "feat(web): add status badge and date formatting"
git commit -m "feat(web): add tickets routes and menu items"
```

---

### Task 5: Lista de chamados

**Files:**
- Create: `apps/web/src/features/tickets/ticket-list-page.tsx`, `apps/web/src/features/tickets/ticket-filters.tsx`, `apps/web/src/features/tickets/ticket-table.tsx`, `apps/web/src/app/header-search.tsx`
- Modify: `apps/web/src/app/router.tsx` (troca o `TicketListPage` provisório), `apps/web/src/app/app-shell.tsx` (busca no cabeçalho)
- Test: `apps/web/src/features/tickets/ticket-list-page.test.tsx`, `apps/web/src/features/tickets/ticket-filters.test.tsx`, `apps/web/src/app/header-search.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`parseTicketSearch`, `toApiQuery`, `ticketListQuery`, `ticketCountsQuery`, `StatusBadge`, `PriorityIndicator`, `formatRelative`, `formatNumber`), `useAuth`.
- Produces: `<TicketListPage />` em `/chamados`; `<HeaderSearch />` no cabeçalho (técnico e admin) que leva a `/chamados` com `q`.

- [ ] **Step 1: Escrever os testes**

```ts
it('shows the tabs Todos, Aberto, Em andamento, Pendente, Resolvido, Fechado with the counts from the API', ...);
it('clicking a tab sets status in the URL and resets page to 1', ...);
it('shows the filters Prioridade, Responsável, Categoria and the sort menu, each writing to the URL', ...);
it('a technician sees only "Eu" and "Não atribuído" in Responsável; an admin also sees the technicians', ...);
it('renders a row per ticket: number, title, requester, priority, status, area/category, relative update', ...);
it('clicking a row opens /chamados/<id>', ...);
it('shows the empty state "Nenhum chamado encontrado" with "Limpar filtros e busca", which clears the filters and q', ...);
it('paginates with Anterior/Próxima and a "x de y" label; Anterior is disabled on page 1', ...);
it('shows a loading state and, on API failure, an error with "Tentar de novo" that refetches', ...);
it('an invalid URL search falls back to defaults without crashing', ...);
it('the header search submits q to /chamados and keeps the other filters out', ...);
it('the header search shows the current q and clears it with the clear button', ...);
it('the page title follows the preset: "Meus chamados", "Não atribuídos", "Todos os chamados", "Chamados"', ...);
```
(Mockar só o `fetch`/cliente da API, no estilo dos testes do provedor de sessão; asserções sobre o DOM e sobre a URL final do roteador.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/features/tickets src/app`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Recriar a tela `04 Listagem` do design: título e subtítulo, abas de status com contagem, linha de filtros (pílulas com menu Radix `DropdownMenu`) e menu de ordenação, tabela em cartão branco com cabeçalho cinza, estado vazio, rodapé de paginação. Sem a coluna de seleção, a barra de ações em lote nem "Excluir" (fora desta fatia). A busca do cabeçalho segue o design (campo arredondado com ícone de lupa; o atalho "Ctrl K" só aparece se fizer o atalho funcionar, senão não mostrar), só para TECHNICIAN e ADMIN. O estado dos filtros vive na URL (navegação com `replace` ao mudar filtro, `push` ao trocar de página). Acessibilidade: tabela com `<th scope>`, linhas navegáveis por teclado (link no assunto), abas com `role="tablist"`, menus operáveis por teclado, foco visível, nada de rolagem horizontal da página em 375 px (a tabela rola dentro do cartão).

- [ ] **Step 4: Rodar tudo e comparar com o design**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Depois, renderizar `/chamados` em 1280 px e 375 px (Playwright com a rede simulada por `page.route`, capturas só na pasta temporária, nunca no repo) ao lado do design. Corrigir diferenças em `fix(web): match ticket list to design`.

- [ ] **Step 5: Commits**

```bash
git commit -m "feat(web): add ticket list table and states"
git commit -m "feat(web): add ticket list filters, tabs and sorting"
git commit -m "feat(web): add header search for tickets"
```

---

### Task 6: Detalhe do chamado e ações

**Files:**
- Create: `apps/web/src/features/tickets/ticket-detail-page.tsx`, `apps/web/src/features/tickets/ticket-actions.tsx`, `apps/web/src/features/tickets/ticket-properties.tsx`, `apps/web/src/features/tickets/ticket-not-found.tsx`
- Modify: `apps/web/src/app/router.tsx` (troca o `TicketDetailPage` provisório)
- Test: `apps/web/src/features/tickets/ticket-detail-page.test.tsx`, `apps/web/src/features/tickets/ticket-actions.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`allowedActions`, mutações, `StatusBadge`, `PriorityIndicator`, `formatNumber`, `formatDateTime`), `useAuth`, e `GET /api/v1/users?role=TECHNICIAN` (só admin) para a lista de atribuição.
- Produces: `<TicketDetailPage />` em `/chamados/$ticketId`; `<TicketActions ticket user />`; `<TicketProperties ticket />`; `<TicketNotFound />`.

- [ ] **Step 1: Escrever os testes**

```ts
it('shows breadcrumb "Chamados / #número", the title, status badge, priority and category', ...);
it('shows the description as the opening card, with the requester name and e-mail', ...);
it('shows the properties panel: Solicitante (name, e-mail), Responsável (or "Não atribuído"), Categoria (area), Criado em, Última atualização', ...);
it.each(actionCases)('renders exactly the buttons allowed for %s', ...);           // usa allowedActions: técnico da fila vê "Assumir"; atribuído vê "Devolver à fila", "Marcar como pendente"/"Retomar", "Resolver", "Reabrir"; admin vê "Atribuir" e as mesmas de status; CLOSED sem botões
it('Assumir sends one request even on a double click and then shows the ticket as IN_PROGRESS and mine', ...);
it('Devolver à fila asks for confirmation, then releases and the ticket shows as OPEN, unassigned', ...);
it('changing priority uses the menu and updates the badge', ...);
it('admin picks a technician in "Atribuir" and the ticket shows him as Responsável', ...);
it('on 409 shows "Este chamado foi alterado por outra pessoa. Atualizamos os dados." and refreshes the ticket', ...);
it('on 403 or 404 after an action shows a clear message without breaking the page', ...);
it('on network error shows "Não foi possível concluir a ação. Tente de novo." and keeps the buttons usable', ...);
it('an unknown or out-of-scope ticket shows the not found page with a link back to the list', ...);
it('a malformed id (not a uuid) shows the not found page without calling the API for a list', ...);
it('buttons are disabled while an action is running and are real <button>s with accessible names', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/features/tickets`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Recriar a parte do chamado da tela `05 Chamado` **sem a conversa** (fatia 5): cabeçalho com migalhas, título, chips e a barra de ações à direita; corpo com o cartão da descrição (autor, hora) e o painel "Propriedades" à direita (empilha embaixo em telas estreitas). Ações pela `allowedActions`; mensagens exatas acima; "Devolver à fila" pede confirmação (diálogo Radix, com foco e Esc); prioridade e atribuição por menu. `TicketNotFound`: "Chamado não encontrado" e link "Voltar para a lista" (para o admin e o técnico, `/chamados`). Atualizar o chamado depois de cada ação pela invalidação das queries da Task 4 (sem polling nesta fatia).

- [ ] **Step 4: Rodar tudo e comparar com o design**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Depois, renderizar `/chamados/<id>` em 1280 px e 375 px com a rede simulada (capturas só na pasta temporária) e comparar com o design. Corrigir diferenças em `fix(web): match ticket detail to design`.

- [ ] **Step 5: Commits**

```bash
git commit -m "feat(web): add ticket detail page and properties"
git commit -m "feat(web): add ticket actions by role and status"
git commit -m "feat(web): add ticket not found page"
```

---

### Task 7: Fluxo real no navegador, CI e documentação

**Files:**
- Create: `apps/web/e2e/tickets.spec.ts`, `apps/web/e2e/support/seed-tickets.ts`
- Modify: `.github/workflows/ci.yml` (só se precisar de variável nova), `docs/DEPLOY.md` (nota sobre as migrations desta fatia), `apps/api/README.md` (se faltar)
- Test: `apps/web/e2e/tickets.spec.ts`

**Interfaces:**
- Consumes: API local com seed (admin do e2e: `E2E_EMAIL`/`E2E_PASSWORD`), `THROTTLE_DISABLED=true`.
- Produces: `seedTickets(): Promise<{ area, category, technician: { email, password, name }, otherTechnician, client: { email, password }, tickets: { open, otherAreaOpen } }>` — cria pela API (login do admin, `POST /areas`, `POST /categories`, `POST /users` para dois técnicos com `areaIds`, cadastro de um cliente, o cliente abre chamados), com nomes únicos por execução.

- [ ] **Step 1: Escrever os testes Playwright** (`e2e/tickets.spec.ts`, cada um com contas e chamados novos do `seedTickets`)

```ts
test('a technician takes a ticket from the queue and sees it under Meus chamados', ...);
test('a technician returns a ticket to the queue and another technician can take it', ...);
test('marking pending and resuming changes the status badge', ...);
test('resolving a ticket shows Resolvido and offers Reabrir', ...);
test('search by title and by #number finds the ticket; a technician does not find a ticket of another area', ...);
test('filters and sort live in the URL and survive a reload', ...);
test('an admin sees all tickets, assigns one to a technician and cannot take it', ...);
test('an unknown ticket id shows the not found page', ...);
test('two technicians taking the same ticket: one succeeds, the other sees the conflict message', ...);
```

- [ ] **Step 2: Rodar localmente e ver passar**

Subir Postgres (já no ar), migrar e semear o admin do e2e, a API numa porta livre com `THROTTLE_DISABLED=true`, e rodar `VITE_API_TARGET=... E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e` em `apps/web` (todos os arquivos de e2e passam, duas vezes). Parar tudo o que subiu; nunca tocar nas portas 3000 nem 5173 nem em servidores que já estavam no ar. Uma falha é um bug real: corrigir na origem em um commit `fix(...)`.

- [ ] **Step 3: Documentar e verificar tudo**

`docs/DEPLOY.md`: nota de que esta versão tem duas migrations novas (enum `PENDING` e coluna `number`), aplicadas no build de produção (`vercel-build`), e que são seguras com chamados existentes. Rodar: em `apps/web` `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`; em `apps/api` `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e`.
```bash
git commit -m "test(web): cover tickets end to end"
git commit -m "docs: note ticket migrations for deploy"
```
