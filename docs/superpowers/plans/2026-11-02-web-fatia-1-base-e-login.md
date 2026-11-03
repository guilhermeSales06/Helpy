# Fatia 1: base do front e login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `apps/web` com visual do design, login real contra a API, sessão que sobrevive a recarregar a página e layout autenticado por perfil.

**Architecture:** SPA React que fala com a API pelo mesmo domínio (`/api`, via proxy do Vite e rewrite da Vercel). Access token em memória, refresh em cookie httpOnly, com um único refresh por vez entre todas as abas. Nenhuma mudança em `apps/api`.

**Tech Stack:** React 19, Vite 8, TypeScript, TanStack Router (rotas por código), TanStack Query, `openapi-fetch`/`openapi-typescript`, Tailwind 4, Radix, React Hook Form, Zod, Vitest, Testing Library, Playwright, oxlint, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-02-helpy-web-design.md`

## Global Constraints

- Node `26.x` (`engines`, como a API). Sem npm workspaces: `apps/web` tem `package.json` e lockfile próprios.
- `typescript` na mesma faixa da API (`^6.0.2`), não a mais recente: `openapi-typescript` e o resto do ecossistema precisam aceitá-la. As demais libs entram na versão atual; se houver conflito de peer dependency, resolva com a versão anterior compatível, nunca com `--force`.
- Módulos ESM, `strict: true`, Prettier com o mesmo `.prettierrc` da API.
- Todo texto de tela em português, copiado do `Helpy v2.dc.html` quando existir.
- Cores: laranja `#FE6F00` (hover `#E86500`), foco `#FFE6D2`, texto `#1C1A18`, secundário `#57524D`, apagado `#8A847E`, fundo `#F7F6F4` e `#FAF9F7`, bordas `#ECE8E4` e `#E2DDD8`, erro `#C8361F`, link `#C24F00`. Fontes Figtree (400–700) e Space Grotesk (500–700).
- Sem controles mortos: nada de botão que não faz nada. Google, Apple, "Esqueci minha senha", busca, sino, "Novo chamado" e "Criar conta" ficam fora desta fatia.
- Commits pequenos, um por ajuste, no formato `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`. Branch `feat/web-foundation`, uma PR no fim.
- Contrato da API, já implementado: `POST /api/v1/auth/login` `{email,password}` → `{accessToken,user}`, 401 se inválido; `POST /api/v1/auth/refresh` → `{accessToken}`, 401 se inválido; `POST /api/v1/auth/logout` → 204; `GET /api/v1/auth/me` → usuário. O cookie tem `path: /api/v1/auth`.
- **Reutilizar um refresh token encerra todas as sessões do usuário.** Nenhum caminho de código pode enviar dois refreshes ao mesmo tempo, nem em abas diferentes.

## Review Focus

1. Duas abas abertas com o token vencido: só um refresh por vez, e nenhuma sessão é derrubada (Task 2).
2. API fora do ar ou erro 500 durante o refresh: a pessoa não é deslogada, vê um erro com "Tentar de novo" (Tasks 2 e 3).
3. Sessão vencida no meio do uso: volta para o login uma única vez, sem loop, e retorna à página onde estava (Tasks 3 e 4).
4. Link malicioso `/login?redirect=https://site-externo.com`: após entrar, a pessoa fica no Helpy (Task 4).
5. Recarregar uma rota interna na Vercel: abre o app e `/api` continua indo para a API (Task 1, teste do `vercel.json`).

---

## Preparação

Antes da Task 1:

```bash
git checkout main && git pull --ff-only && git checkout -b feat/web-foundation
```

Os arquivos do design estão em `../Helpy — Design de helpdesk.zip`, fora do repo. Extraia em uma pasta temporária para consultar o visual; as Tasks 1 e 5 dizem o que usar.

---

### Task 1: Projeto `apps/web`, tokens e qualidade

**Files:**
- Create: `apps/web/package.json`, `apps/web/package-lock.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/.prettierrc`, `apps/web/.prettierignore`, `apps/web/oxlint.json`, `apps/web/vercel.json`
- Create: `apps/web/src/main.tsx`, `apps/web/src/app/styles.css`, `apps/web/src/test/setup.ts`
- Create: `apps/web/public/` com `ilustra-login.png` e `ilustra-cadastro.png` (de `assets/` do zip)
- Test: `apps/web/src/app/vercel-config.test.ts`
- Modify: `.github/workflows/ci.yml`, `README.md` (linha de `apps/web`)

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `format:check`, `test`, `test:e2e`, `gen:api`; classes Tailwind `bg-brand`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `bg-surface`, `font-display`.

- [ ] **Step 1: Criar o projeto Vite com React e TypeScript, instalar a stack da fatia e fazer o commit (`chore: scaffold web app`)**

`index.html` em `pt-BR`, com título `Helpy`. `vite.config.ts` com `server.proxy` e `preview.proxy` de `/api` para `http://localhost:3000`, e `changeOrigin: true`. Configuração do Vitest com ambiente `jsdom` e `setup.ts` carregando `@testing-library/jest-dom/vitest`.

- [ ] **Step 2: Definir os tokens em `styles.css` e fazer o commit (`feat: add design tokens`)**

Tailwind 4 com `@theme`, usando as cores e fontes das Global Constraints. Fontes pelo mesmo link do Google Fonts do design, no `index.html`. `body` com `font-family` Figtree, cor `#1C1A18` e `-webkit-font-smoothing: antialiased`.

- [ ] **Step 3: Escrever o teste do `vercel.json`**

```ts
it('sends /api to the API before falling back to the app', () => {
  const { rewrites } = vercelConfig;
  expect(rewrites[0].source).toBe('/api/:path*');
  expect(rewrites[0].destination).toBe(
    'https://helpy-lilac.vercel.app/api/:path*',
  );
  expect(rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd apps/web && npm test -- vercel-config`
Expected: FAIL, arquivo `vercel.json` não existe.

- [ ] **Step 5: Criar `vercel.json` com esses dois rewrites, nessa ordem, e rodar de novo**

Run: `npm test -- vercel-config`
Expected: PASS.

- [ ] **Step 6: Adicionar o job `web` ao CI**

Job separado do `ci`, com `working-directory: apps/web`, Node 26 e cache em `apps/web/package-lock.json`, rodando `npm ci`, `format:check`, `lint`, `typecheck`, `test` e `build`. A Task 7 acrescenta o e2e.

- [ ] **Step 7: Verificar tudo e fazer o commit (`ci: add web job`)**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: todos passam.

---

### Task 2: Cliente da API com refresh único

**Files:**
- Create: `apps/web/src/shared/api/schema.d.ts` (gerado), `apps/web/src/shared/api/token-store.ts`, `apps/web/src/shared/api/refresh.ts`, `apps/web/src/shared/api/client.ts`
- Test: `apps/web/src/shared/api/refresh.test.ts`, `apps/web/src/shared/api/client.test.ts`

**Interfaces:**
- Produces:
  - `getAccessToken(): string | null`, `setAccessToken(token: string | null): void`
  - `refreshSession(): Promise<RefreshResult>`, com `type RefreshResult = { status: 'ok'; accessToken: string } | { status: 'expired' } | { status: 'unavailable' }`
  - `api`, cliente `openapi-fetch` tipado com `baseUrl: '/api/v1'`
  - `onSessionExpired(listener: () => void): () => void`, que devolve a função de cancelar a inscrição

- [ ] **Step 1: Gerar os tipos e fazer o commit (`feat: generate API types`)**

Script `gen:api`: `openapi-typescript http://localhost:3000/docs-json -o src/shared/api/schema.d.ts`. Suba a API local (README de `apps/api`), rode o script e commite o arquivo gerado. O CI não precisa da API para compilar. Adicione `schema.d.ts` ao `.prettierignore`.

- [ ] **Step 2: Escrever os testes de `refreshSession`**

Com `fetch` simulado e `navigator.locks` simulado:

```ts
it('shares one request between concurrent calls', async () => {
  const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(a).toEqual({ status: 'ok', accessToken: 'new' });
  expect(b).toEqual(a);
});
it('runs inside the cross-tab lock "helpy-refresh"', ...);        // locks.request chamado com esse nome
it('falls back to a plain request where Web Locks is missing', ...);
it('returns expired on 401 and clears the token', ...);
it('returns unavailable on 500 and keeps the token', ...);
it('returns unavailable on a network error and keeps the token', ...);
it('sends a new request after the previous one settled', ...);
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- refresh`
Expected: FAIL, módulo não existe.

- [ ] **Step 4: Implementar `refreshSession` em `refresh.ts` e o `token-store.ts`**

Guarde a promise em andamento na memória para unir chamadas da mesma aba. Dentro de `navigator.locks.request('helpy-refresh', ...)`, faça o `POST /api/v1/auth/refresh` com `credentials: 'include'`, para outra aba só enviar o cookie depois de a primeira terminar a rotação. Sem Web Locks, faça a requisição direto.

- [ ] **Step 5: Rodar, ver passar e fazer o commit (`feat: add single-flight session refresh`)**

Run: `npm test -- refresh`
Expected: PASS.

- [ ] **Step 6: Escrever os testes do cliente**

```ts
it('sends the bearer token', ...);
it('on 401 refreshes once and retries with the new token', ...);
it('makes concurrent 401s wait for the same refresh', ...);      // 3 requisições, 1 refresh, 3 repetições
it('does not retry a second time when the retry also returns 401', ...);
it('notifies onSessionExpired when the refresh is expired', ...);
it('returns the original 401 without expiring when the refresh is unavailable', ...);
it('never refreshes for /auth/login, /auth/refresh or /auth/logout', ...);
it('retries a POST with its original body', ...);
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npm test -- client`
Expected: FAIL.

- [ ] **Step 8: Implementar `api` e `onSessionExpired` em `client.ts`**

Middleware do `openapi-fetch`: `onRequest` injeta o token e guarda um `clone()` da requisição, necessário para repetir com corpo; `onResponse` trata o 401 usando `refreshSession`. Todas as requisições usam `credentials: 'include'`.

- [ ] **Step 9: Rodar, ver passar e fazer o commit (`feat: add API client with auth retry`)**

Run: `npm test -- client`
Expected: PASS.

---

### Task 3: Sessão do usuário

**Files:**
- Create: `apps/web/src/features/auth/auth-provider.tsx`, `apps/web/src/features/auth/use-auth.ts`
- Test: `apps/web/src/features/auth/auth-provider.test.tsx`

**Interfaces:**
- Consumes: `api`, `refreshSession`, `setAccessToken`, `onSessionExpired` (Task 2)
- Produces:
  - `type User = components['schemas']['UserResponseDto']`
  - `type AuthState = { status: 'loading' } | { status: 'unavailable' } | { status: 'anonymous' } | { status: 'authenticated'; user: User }`
  - `useAuth(): { state: AuthState; login(email: string, password: string): Promise<LoginResult>; logout(): Promise<void>; retry(): void }`
  - `type LoginResult = 'ok' | 'invalid' | 'unavailable'`
  - `<AuthProvider>`

- [ ] **Step 1: Escrever os testes**

```tsx
it('starts loading and becomes authenticated when refresh and /me succeed', ...);
it('becomes anonymous when the refresh is expired', ...);
it('becomes unavailable on a server error, and retry() tries again', ...);
it('refreshes only once under StrictMode', ...);
it('login returns invalid on 401 and stays anonymous', ...);
it('login returns unavailable on a 500 or network error', ...);
it('login stores the token and the user', ...);
it('logout clears the token and becomes anonymous even if the request fails', ...);
it('becomes anonymous when the session expires mid-use', ...);
it('clears cached queries on logout and on expiry', ...);        // outro usuário não vê dados do anterior
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- auth-provider`
Expected: FAIL.

- [ ] **Step 3: Implementar `AuthProvider` e `useAuth`**

Ao montar: `refreshSession`, depois `GET /auth/me`. Ao sair ou expirar: `queryClient.clear()`.

- [ ] **Step 4: Rodar, ver passar e fazer o commit (`feat: add auth session provider`)**

Run: `npm test -- auth-provider`
Expected: PASS.

---

### Task 4: Rotas e proteção

**Files:**
- Create: `apps/web/src/app/router.tsx`, `apps/web/src/app/providers.tsx`, `apps/web/src/features/auth/safe-redirect.ts`, `apps/web/src/features/auth/session-screens.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/features/auth/safe-redirect.test.ts`, `apps/web/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthState` (Task 3)
- Produces: `safeRedirect(target: unknown): string`; rotas `/login` (com busca `redirect?: string`) e `/` dentro da rota protegida `_app`. Slices seguintes adicionam filhas a `_app`.

- [ ] **Step 1: Escrever os testes**

```ts
it.each([
  ['/chamados?status=OPEN', '/chamados?status=OPEN'],
  ['https://evil.com', '/'],
  ['//evil.com', '/'],
  ['/\\evil.com', '/'],
  ['javascript:alert(1)', '/'],
  ['/login', '/'],
  [undefined, '/'],
])('safeRedirect(%s) is %s', (input, output) => {
  expect(safeRedirect(input)).toBe(output);
});
```

```tsx
it('sends anonymous visitors to /login with the page they wanted', ...);
it('shows a loading screen while the session is unknown', ...);
it('shows the error screen with "Tentar de novo" when unavailable', ...);
it('sends authenticated visitors away from /login', ...);
it('returns to the original page after login', ...);
it('goes to / when redirect points to another site', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- safe-redirect router`
Expected: FAIL.

- [ ] **Step 3: Implementar `safeRedirect`, as rotas, os providers e as telas de carregando e indisponível**

Rotas por código, para o router receber `auth` por contexto. Providers: `QueryClientProvider`, `AuthProvider`, `RouterProvider`. Textos da tela indisponível: "Não foi possível conectar ao Helpy." e botão "Tentar de novo".

- [ ] **Step 4: Rodar, ver passar e fazer o commit (`feat: add routes and auth guard`)**

Run: `npm test -- safe-redirect router`
Expected: PASS.

---

### Task 5: Tela de login

**Files:**
- Create: `apps/web/src/shared/ui/button.tsx`, `apps/web/src/shared/ui/text-field.tsx`, `apps/web/src/shared/ui/password-field.tsx`, `apps/web/src/shared/ui/brand-mark.tsx`, `apps/web/src/features/auth/login-page.tsx`, `apps/web/src/features/auth/login-schema.ts`
- Modify: `apps/web/src/app/router.tsx`
- Test: `apps/web/src/features/auth/login-page.test.tsx`

**Interfaces:**
- Consumes: `useAuth().login`, `safeRedirect`
- Produces: `<Button variant="primary" | "secondary">`, `<TextField label error ...inputProps>`, `<PasswordField label error ...inputProps>`, `<BrandMark />`, usados nas próximas fatias.

- [ ] **Step 1: Escrever os testes**

```tsx
it('requires an email', ...);       // "Informe seu e-mail."
it('rejects a bad email', ...);     // "Digite um e-mail válido, como nome@empresa.com.br."
it('requires a password', ...);     // "Informe sua senha."
it('does not enforce a password length on login', ...);
it('shows "Entrando…" and blocks a second submit while waiting', ...);
it('shows "E-mail ou senha incorretos." on invalid and keeps the email', ...);
it('shows "Não foi possível entrar. Tente de novo." on unavailable', ...);
it('toggles password visibility with an accessible label', ...);
it('ties each error to its input via aria-describedby and aria-invalid', ...);
it('shows no Google, Apple, forgot password or sign up controls', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- login-page`
Expected: FAIL.

- [ ] **Step 3: Implementar os componentes e a tela**

Recrie a tela `01 Login` do `Helpy v2.dc.html`, linhas 24 a 72: painel laranja com marca `h!`, "Helpy", "O sistema que você ama oferecer.", "Chamados, conversas e prioridades da sua equipe de suporte em um só lugar." e `ilustra-login.png`; formulário com "Bem-vindo de volta" e "Entre para continuar seus atendimentos." Alt da imagem: "Ilustração de atendente com notebook". Remova o divisor "ou continue com" e os botões sociais. Validação com Zod e React Hook Form.

- [ ] **Step 4: Rodar, ver passar e fazer o commit (`feat: add login page`)**

Run: `npm test -- login-page`
Expected: PASS.

- [ ] **Step 5: Comparar visualmente**

Com a API local (`npm run db:up`, `start:dev`) e `npm run dev`, abra `http://localhost:5173/login` ao lado do `Helpy v2.dc.html`, em 1280 px e 375 px. Em 375 px, os painéis empilham sem rolagem horizontal. Ajuste e commite as diferenças (`fix: match login to design`).

---

### Task 6: Layout autenticado

**Files:**
- Create: `apps/web/src/app/app-shell.tsx`, `apps/web/src/app/nav-items.ts`, `apps/web/src/app/profile-menu.tsx`, `apps/web/src/app/home-page.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Test: `apps/web/src/app/nav-items.test.ts`, `apps/web/src/app/app-shell.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `User`, `BrandMark`
- Produces: `navItemsFor(role: User['role']): NavItem[]`, com `type NavItem = { label: string; to: string; icon: string }`; `<AppShell>` com `<Outlet />`. Próximas fatias adicionam itens a `navItemsFor`, e controles ao cabeçalho.

- [ ] **Step 1: Escrever os testes**

```ts
it.each([
  ['CLIENT', ['Meus chamados']],
  ['TECHNICIAN', ['Visão geral']],
  ['ADMIN', ['Visão geral']],
])('%s sees %j', (role, labels) => {
  expect(navItemsFor(role).map((i) => i.label)).toEqual(labels);
});
```

```tsx
it('shows the user name and initials in the profile menu', ...);
it('logs out from the profile menu', ...);          // botão "Sair"
it('collapses the sidebar and remembers it after reload', ...);
it('still renders when localStorage throws', ...);
it('starts collapsed below 1180px when nothing is saved', ...);
it('home greets the user by first name', ...);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- nav-items app-shell`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Menu lateral e cabeçalho de 64 px, conforme as linhas 139 a 214 do `Helpy v2.dc.html`, com "Recolher menu" e menu de perfil em Radix `DropdownMenu`. Nesta fatia, o cabeçalho tem só o perfil, e o menu de perfil só "Sair". A página inicial mostra um título "Olá, {primeiro nome}." e o texto "Seus chamados vão aparecer aqui.".

- [ ] **Step 4: Rodar, ver passar e fazer o commit (`feat: add authenticated app shell`)**

Run: `npm test -- nav-items app-shell`
Expected: PASS.

---

### Task 7: Fluxo real no navegador e deploy

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/auth.spec.ts`
- Modify: `.github/workflows/ci.yml`, `docs/DEPLOY.md`, `apps/web/.gitignore`

**Interfaces:**
- Consumes: API local com seed. E-mail e senha vêm de `E2E_EMAIL` e `E2E_PASSWORD`.

- [ ] **Step 1: Escrever os testes**

```ts
test('logs in, survives a reload and logs out', ...);
test('shows an error for a wrong password', ...);
test('returns to the requested page after login', ...);
test('two tabs reloading together both stay logged in', async ({ context }) => {
  // duas páginas no mesmo contexto, reload simultâneo,
  // as duas continuam autenticadas e um novo reload também funciona
});
test('a deleted refresh cookie sends the user back to login', ...);
```

`playwright.config.ts`: Chromium, `webServer` rodando `npm run build && npm run preview` na porta 4173. A API é iniciada à parte.

- [ ] **Step 2: Rodar localmente e ver passar**

Com Postgres, migrations, seed e API no ar:

Run: `E2E_EMAIL=admin@helpy.local E2E_PASSWORD=<senha do seed> npm run test:e2e`
Expected: 5 testes passam. Falha aqui é bug real: corrija no código da task que o causou, em um commit `fix:`.

- [ ] **Step 3: Adicionar ao job `web` do CI e fazer o commit (`test: add auth e2e flow`)**

Adicione ao job `web` o serviço `postgres:17-alpine` na porta `5433`, igual ao do job `ci`. Em `apps/api`: `npm ci`, `npm run db:deploy`, `npm run db:seed`, `npm run build` e `node dist/main` em segundo plano, aguardando `/api/v1/health`. Depois, em `apps/web`: `npx playwright install --with-deps chromium` e `npm run test:e2e`. Defina `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `E2E_EMAIL` e `E2E_PASSWORD` com valores só de teste, sem `NODE_ENV=production`, para o cookie funcionar em HTTP.

- [ ] **Step 4: Documentar e fazer o commit (`docs: add front-end deploy steps`)**

Em `docs/DEPLOY.md`, seção 5: novo projeto na Vercel com Root Directory `apps/web`, framework Vite. Mencione que o destino do rewrite em `apps/web/vercel.json` precisa acompanhar o endereço da API.

- [ ] **Step 5: Verificar tudo e abrir a PR**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`
Expected: todos passam. Abra a PR para `main` e aguarde o CI.

---

## Ações manuais do Guilherme (fora do código)

Não bloqueiam a PR. O login publicado depende delas.

1. Criar o projeto do front na Vercel, com Root Directory `apps/web`.
2. Quando a API nova existir, criar o projeto no Supabase e o projeto da API na Vercel, conforme `docs/DEPLOY.md`, e trocar o destino em `apps/web/vercel.json`, atualizando o teste da Task 1.
3. Conferir na URL publicada: login, recarregar uma rota interna e sair. Esse é o único teste do rewrite real da Vercel.
