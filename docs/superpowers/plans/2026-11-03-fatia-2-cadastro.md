# Fatia 2: cadastro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualquer pessoa cria uma conta de cliente pela tela de cadastro e já entra logada, com limite de tentativas em login e cadastro.

**Architecture:** A API ganha `POST /api/v1/auth/register` (público, sempre `CLIENT`, devolve o mesmo formato do login e grava o cookie de refresh) e um limitador de tentativas por IP em login e cadastro. O front ganha a rota `/cadastro`, `register()` no provedor de sessão e os links entre login e cadastro que a fatia 1 deixou de fora.

**Tech Stack:** NestJS 12, Prisma, `@nestjs/throttler`, Vitest + Supertest (API); React, TanStack Router, React Hook Form, Zod, Playwright (web).

**Spec:** `docs/superpowers/specs/2026-11-02-helpy-web-design.md` (seções "Mudanças na API → Cadastro / Limite de tentativas" e "Demo").

## Global Constraints

- Cadastro público cria **sempre** `Role.CLIENT`. Técnico e admin continuam criados como hoje (`POST /users` por admin, seed).
- O corpo de `POST /auth/register` aceita só `name`, `email`, `password`. O `ValidationPipe` global já usa `whitelist` + `forbidNonWhitelisted`: enviar `role`, `phone` ou qualquer outro campo responde 400.
- Senha: 8 a 128 caracteres, ao menos uma letra maiúscula e ao menos um número (as mesmas três regras do design: "8+ caracteres", "Uma letra maiúscula", "Um número"). A API valida; o front só espelha.
- E-mail normalizado como no login (`trim` + minúsculas). Duplicado responde **409**.
- Nome: `trim`, não vazio, até 120 caracteres na API. O front exige nome e sobrenome (duas palavras), como o design.
- Resposta do registro: **201** com `LoginResponseDto` (`accessToken` + `user`), cookie `refresh_token` com as mesmas opções do login (`httpOnly`, `path /api/v1/auth`, `Secure`/`SameSite=None` só em produção). A pessoa fica logada.
- Limites por IP (valores fixados pelo plano): **login 10 por minuto, cadastro 5 por minuto**, resposta **429**. Só login e cadastro são limitados; refresh, logout, me e o resto da API não.
- Testes da API não podem esbarrar no limite: o e2e usa `THROTTLE_DISABLED=true`; só o teste do limite liga de novo (`vi.stubEnv('THROTTLE_DISABLED', 'false')`). Em produção o limitador fica ligado por padrão.
- Contador em memória, por instância: numa função serverless ele não é global. Isso é aceito para a demo e deve estar escrito em `apps/api/README.md`.
- Texto das telas em português; mensagens exatas abaixo. Sem controles mortos: nada de login com Google/Apple, nem links para "Termos de uso" ou "Política de privacidade" que não existem. No lugar da frase de termos, o aviso de demo: "Este é um ambiente de demonstração: os dados são públicos e apagados periodicamente."
- Convenção de nomes: branch `feat/cadastro`; commits `tipo(escopo): assunto`, escopo `api`, `web`, `docs` ou `ci`, em minúsculas, no imperativo, até ~60 caracteres. Commits pequenos, um por ajuste. Não fazer push.
- Cores, fontes e componentes do front: os da fatia 1 (`apps/web/src/shared/ui`, tokens em `styles.css`). O visual do cadastro vem do `Helpy v2.dc.html`, tela `02 Cadastro`, linhas 74 a 130 (fora do repo, em `/tmp/claude-1000/-home-guilhermeas-dev-PROJETOS-helpy-Helpy/6a90f213-27b7-4191-9335-f35aa3f4b355/scratchpad/design/`).

## Review Focus

1. Enviar `role: "ADMIN"` (ou `TECHNICIAN`) no cadastro: tem que dar 400, nunca criar um usuário privilegiado (Task 2).
2. Duas requisições simultâneas com o mesmo e-mail (ou com e-mails que só diferem em maiúsculas): uma cria, a outra recebe 409, nunca 500 (Task 2).
3. Senha com 7 e com 129 caracteres, sem maiúscula e sem número: 400 (Task 2). Senha de exatamente 8 e de 128 caracteres: aceita.
4. Nome só com espaços ou com 121 caracteres: 400 (Task 2); no front, uma palavra só não passa (Task 4).
5. Limite de tentativas: a 11ª tentativa de login e a 6ª de cadastro no mesmo minuto dão 429 com mensagem clara na tela, e refresh/me/logout nunca dão 429 (Tasks 1, 3, 4).
6. Todos os IPs parecerem um só: atrás do proxy da Vercel o IP pode ser o do proxy, e aí todo mundo divide o mesmo limite. A configuração de `trust proxy` precisa ser possível por variável de ambiente e estar documentada (Task 1).
7. Voltar para a tela de cadastro estando logado, e abrir `/cadastro?redirect=https://site-externo.com`: fica no Helpy (Task 4).

---

### Task 1: Limitador de tentativas na API

**Files:**
- Modify: `apps/api/package.json` (dependência `@nestjs/throttler`), `apps/api/src/app.module.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/main.ts` ou `apps/api/src/setup-app.ts` (trust proxy), `apps/api/.env.example`, `apps/api/vitest.config.e2e.ts`, `apps/api/README.md`
- Create: `apps/api/src/common/throttle.ts`
- Test: `apps/api/test/throttle.e2e-spec.ts`

**Interfaces:**
- Produces: `LOGIN_THROTTLE`, `REGISTER_THROTTLE` em `apps/api/src/common/throttle.ts`, do tipo `{ default: { limit: number; ttl: number } }` (login `limit: 10`, cadastro `limit: 5`, `ttl: 60_000`), para usar com `@Throttle(...)`. Variáveis de ambiente `THROTTLE_DISABLED` (`'true'` desliga) e `TRUST_PROXY` (número de saltos de proxy confiáveis; ausente = não confiar em nenhum).

- [ ] **Step 1: Escrever os testes em `throttle.e2e-spec.ts`**

Com `vi.stubEnv('THROTTLE_DISABLED', 'false')` no `beforeEach` e `vi.unstubAllEnvs()` no `afterEach`:

```ts
it('allows 10 logins per minute and answers 429 to the 11th', ...);        // 10x 401 (e-mail inexistente), 11a = 429
it('does not limit refresh, logout or me', ...);                           // 30 chamadas sem 429
it('counts login attempts per IP, not per e-mail', ...);                   // e-mails diferentes dividem o mesmo contador
it('does not throttle at all when THROTTLE_DISABLED is true', ...);        // 15 logins, nenhum 429
```

O teste do cadastro (6ª tentativa = 429) entra na Task 2, junto com o endpoint.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm run test:e2e -- throttle`
Expected: FAIL (nenhum 429; o módulo não existe).

- [ ] **Step 3: Implementar**

Instalar `@nestjs/throttler` (versão compatível com Nest 12, sem `--force`). Registrar `ThrottlerModule.forRoot` em `AppModule` com `skipIf: () => process.env.THROTTLE_DISABLED === 'true'` (lido a cada requisição, para o teste poder religar) e um limite padrão alto o bastante para nunca valer sozinho; registrar o `ThrottlerGuard` como guard global **depois** dos guards de autenticação, e usar `@Throttle(LOGIN_THROTTLE)` no `login` e `@SkipThrottle()` nos demais métodos de `AuthController` e nos outros controllers de modo que só login e cadastro sejam limitados (alternativa equivalente: guard aplicado só nesses dois métodos). `TRUST_PROXY`: em `setupApp`, se a variável for um inteiro positivo, `app.set('trust proxy', n)` no adaptador Express, e o comportamento atual quando ausente. A resposta 429 é a padrão do throttler.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:e2e -- throttle` e depois `npm run test:e2e` inteiro
Expected: PASS em tudo. Para os demais e2e não esbarrarem no limite, `vitest.config.e2e.ts` ganha `THROTTLE_DISABLED: 'true'` em `env`.

- [ ] **Step 5: Documentar e fazer o commit**

`apps/api/.env.example`: `THROTTLE_DISABLED` e `TRUST_PROXY` comentados, com o que fazem. `apps/api/README.md`: seção curta sobre o limite de tentativas, a limitação do contador por instância e o aviso de `TRUST_PROXY` na Vercel (o valor certo só se confirma testando a URL publicada).

```bash
git add apps/api
git commit -m "feat(api): limit login attempts per IP"
```
(dividir em dois commits se natural: `chore(api): add throttler dependency` e `feat(api): limit login attempts per IP`.)

---

### Task 2: Endpoint de cadastro na API

**Files:**
- Create: `apps/api/src/auth/dto/register.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/users/users.module.ts` (exportar o serviço se for reutilizado)
- Test: `apps/api/test/register.e2e-spec.ts`

**Interfaces:**
- Consumes: `REGISTER_THROTTLE` e `@Throttle` (Task 1); `LoginResponseDto`, `UserResponseDto` existentes.
- Produces: `POST /api/v1/auth/register` com corpo `RegisterDto { name: string; email: string; password: string }`, resposta `201` `LoginResponseDto`; `AuthService.register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: UserResponseDto }>`.

- [ ] **Step 1: Escrever os testes em `register.e2e-spec.ts`** (`THROTTLE_DISABLED` já é `true` no e2e)

```ts
it('creates a CLIENT, logs them in and sets the refresh cookie', ...);       // 201, user.role === 'CLIENT', accessToken, cookie refresh_token, e depois POST /auth/login com a mesma senha funciona e /auth/me devolve o usuário
it('stores the e-mail trimmed and lowercased', ...);                          // "  Ana@Empresa.COM " vira "ana@empresa.com"
it('answers 409 to an e-mail already in use, in any letter case', ...);
it('answers 409, never 500, when two requests race on the same e-mail', ...); // Promise.all de 2: um 201 e um 409
it.each(['role', 'phone', 'active', 'areaIds'])('rejects the extra field %s with 400', ...);
it('never creates an admin or technician even when role is sent', ...);       // role: 'ADMIN' => 400 e nenhum usuário novo no banco
it.each([
  ['7 characters', 'Abcdef1'],
  ['129 characters', 'A1' + 'a'.repeat(127)],
  ['no uppercase letter', 'abcdefg1'],
  ['no number', 'Abcdefgh'],
])('rejects a password with %s', ...);                                        // 400
it.each([['exactly 8', 'Abcdefg1'], ['exactly 128', 'A1' + 'a'.repeat(126)]])('accepts a password with %s', ...);
it('rejects a blank name and a name over 120 characters', ...);
it('rejects an invalid e-mail', ...);
it('does not return the password hash', ...);
it('answers 429 to the 6th attempt in a minute when throttling is on', ...);  // stubEnv THROTTLE_DISABLED=false; 5x 201/409/400 conforme o e-mail, 6a = 429
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npm run test:e2e -- register`
Expected: FAIL (rota 404).

- [ ] **Step 3: Implementar**

`RegisterDto` em `auth/dto/register.dto.ts` com `@ApiProperty`, transformações e validações iguais às do `CreateUserDto` para nome e e-mail (`trim`; e-mail em minúsculas), mais a senha: `@Length(8, 128)`, `@Matches(/[A-Z]/)`, `@Matches(/\d/)` com mensagens claras. `AuthService.register(dto)`: cria o usuário `CLIENT` reutilizando a criação já existente e o tratamento de e-mail duplicado (`isUniqueViolation` => `ConflictException`), e inicia a sessão pelo mesmo caminho do login — extraia o trecho de "limpar tokens vencidos, criar refresh token, assinar o access token" do `login` para um método privado compartilhado, sem mudar o comportamento do login (os testes atuais de auth são a rede). `AuthController`: `@Public()`, `@Post('register')`, `@HttpCode(201)`, `@Throttle(REGISTER_THROTTLE)`, `@ApiCreatedResponse({ type: LoginResponseDto })`, `@ApiConflictResponse`, grava o cookie com o mesmo `setRefreshCookie`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:e2e` inteiro, depois `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test`
Expected: tudo passa, sem avisos novos.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add public client registration"
```
(commit separado para o refactor do início de sessão: `refactor(api): share session start between login and register`, feito antes e com a suíte de auth existente verde.)

---

### Task 3: Tipos, `register` no provedor de sessão e 429 no login

**Files:**
- Modify: `apps/web/src/shared/api/schema.d.ts` (regenerado), `apps/web/src/features/auth/use-auth.ts`, `apps/web/src/features/auth/auth-provider.tsx`, `apps/web/src/features/auth/login-page.tsx`
- Test: `apps/web/src/features/auth/auth-provider.test.tsx`, `apps/web/src/features/auth/login-page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/auth/register` (Task 2).
- Produces:
  - `type RegisterResult = 'ok' | 'email-taken' | 'rate-limited' | 'invalid' | 'unavailable'` e `register(input: { name: string; email: string; password: string }): Promise<RegisterResult>` em `AuthContextValue`.
  - `LoginResult` ganha `'rate-limited'`.

- [ ] **Step 1: Regenerar os tipos**

Subir a API local (README de `apps/api`; porta 3000 pode estar ocupada nesta máquina, use `PORT=3010` e ajuste o destino do `gen:api` só para este comando, sem mudar o script), rodar `npm run gen:api` em `apps/web`, conferir que `schema.d.ts` ganhou `/api/v1/auth/register`, parar a API. Commit `chore(web): regenerate API types for registration`.

- [ ] **Step 2: Escrever os testes**

Em `auth-provider.test.tsx`:
```ts
it('register stores the token and the user, like login', ...);                 // 201 => 'ok', state authenticated
it('register returns email-taken on 409 and stays anonymous', ...);
it('register returns rate-limited on 429', ...);
it('register returns invalid on 400', ...);
it('register returns unavailable on a 500 or a network error', ...);
it('login returns rate-limited on 429', ...);
it('a registered session survives like any other: the first 401 refreshes once', ...);   // opcional se já coberto pelo cliente
```
Em `login-page.test.tsx`: `it('shows "Muitas tentativas. Aguarde um minuto e tente de novo." on rate-limited', ...)`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/features/auth`
Expected: FAIL.

- [ ] **Step 4: Implementar**

`register` em `auth-provider.tsx` no mesmo estilo de `login` (chamada com o caminho completo do schema, `setAccessToken`, estado autenticado, mesma guarda de envio duplo no que couber, limpar cache de consultas de um usuário anterior não é necessário porque a pessoa estava anônima). Mapear 201 => `ok`, 409 => `email-taken`, 429 => `rate-limited`, 400 => `invalid`, o resto e erros de rede => `unavailable`. No `login`, 429 => `rate-limited` (sem mudar os outros resultados). `LoginPage` mostra a mensagem do teste para `rate-limited`.

- [ ] **Step 5: Rodar e ver passar; commit**

Run: `npx vitest run src/features/auth` e `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo passa.
```bash
git commit -m "feat(web): add register to the session provider"
```
(login 429 em commit próprio: `feat(web): show a message when login is rate limited`.)

---

### Task 4: Tela de cadastro e rota

**Files:**
- Create: `apps/web/src/features/auth/signup-page.tsx`, `apps/web/src/features/auth/signup-schema.ts`, `apps/web/src/features/auth/password-requirements.tsx`
- Modify: `apps/web/src/app/router.tsx`, `apps/web/src/features/auth/login-page.tsx` (link "Criar conta")
- Test: `apps/web/src/features/auth/signup-schema.test.ts`, `apps/web/src/features/auth/signup-page.test.tsx`, `apps/web/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `useAuth().register`, `RegisterResult` (Task 3); `safeRedirect`; `TextField`, `PasswordField`, `Button`, `BrandMark`.
- Produces: rota pública `/cadastro` (busca `redirect?: string`); `signupSchema` (zod) com `name`, `email`, `password`, `confirmPassword`; `passwordRules(password: string): { label: string; ok: boolean }[]` com exatamente os rótulos "8+ caracteres", "Uma letra maiúscula", "Um número".

- [ ] **Step 1: Escrever os testes**

`signup-schema.test.ts`:
```ts
it.each([['Ana'], ['  Ana  '], ['']])('rejects a name without surname: %j', ...);   // "Informe nome e sobrenome."
it('accepts two or more words', ...);
it('rejects a bad e-mail', ...);                                                       // "Digite um e-mail válido."
it('rejects a password that fails any rule', ...);                                     // "A senha ainda não atende a todos os requisitos."
it('rejects confirmation that differs', ...);                                          // "As senhas não coincidem."
it('passwordRules reflects each rule live', ...);
```
`signup-page.test.tsx` (mockar só `useAuth`):
```ts
it('shows the three password rules and turns each green as they are met', ...);
it('toggles "Mostrar senhas" for both password fields', ...);
it('submits name, trimmed e-mail and password, and navigates to safeRedirect(redirect) on ok', ...);
it('shows "Já existe uma conta com este e-mail." on email-taken and keeps what was typed', ...);
it('shows "Muitas tentativas. Aguarde um minuto e tente de novo." on rate-limited', ...);
it('shows "Não foi possível criar a conta. Tente de novo." on unavailable', ...);
it('shows "Revise os dados e tente de novo." on invalid', ...);
it('blocks a second submit while waiting and shows "Criando conta…"', ...);
it('ties each error to its input with aria-describedby and aria-invalid', ...);
it('shows the demo notice and no Google, Apple, terms or privacy controls', ...);
it('links back to the login page', ...);                                                  // "Entrar"
```
`router.test.tsx`: `it('an authenticated visitor on /cadastro is sent away', ...)` e `it('an anonymous visitor can open /cadastro and /login links to it', ...)`; `/cadastro?redirect=https://site-externo.com` termina em `/`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/features/auth src/app`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Recriar `02 Cadastro` do design: painel de formulário à esquerda (título "Crie sua conta", subtítulo "Leva menos de um minuto para começar a atender.", campos "Nome completo" (placeholder "Como você quer ser chamado"), "E-mail corporativo" (placeholder "nome@empresa.com.br"), "Senha" ("Crie uma senha") e "Confirmar senha" ("Repita a senha") lado a lado, lista de requisitos, caixa "Mostrar senhas", botão "Criar conta"/"Criando conta…", aviso de demo e "Já tem uma conta? Entrar") e painel laranja à direita com a marca, "O sistema que você ama oferecer." e `ilustra-cadastro.png` (alt "Ilustração de atendente pensativa com notebook"); no celular o painel laranja vai para baixo (`flex-wrap-reverse`, como o design). Remover do design o divisor "ou cadastre-se com e-mail" e os botões Google/Apple, e trocar a frase de termos pelo aviso de demo. Rota `/cadastro` registrada em `router.tsx` com o mesmo comportamento do `/login` para quem já está logado e o mesmo `redirect` seguro. Em `login-page.tsx`, adicionar "Ainda não tem conta? Criar conta" apontando para `/cadastro` (preservando o `redirect` da busca). Reaproveitar os componentes compartilhados; extrair para `shared/ui` só o que o login e o cadastro realmente dividem.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/features/auth src/app`, depois o portão completo: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo passa, sem avisos.

- [ ] **Step 5: Comparar com o design**

Renderizar `/cadastro` em 1280 px e 375 px (Playwright, API simulada com `page.route` se preciso; capturas só na pasta temporária, nunca no repo) ao lado do design. Sem rolagem horizontal em 375 px. Corrigir diferenças em `fix(web): match signup to design`.

- [ ] **Step 6: Commits**

```bash
git commit -m "feat(web): add signup schema and password rules"
git commit -m "feat(web): add signup page and route"
git commit -m "feat(web): link login to signup"
```

---

### Task 5: Fluxo real no navegador, CI e documentação

**Files:**
- Modify: `apps/web/e2e/` (novo `signup.spec.ts`), `.github/workflows/ci.yml` (job `web`: variável `THROTTLE_DISABLED=true` na API do e2e), `docs/DEPLOY.md`
- Test: `apps/web/e2e/signup.spec.ts`

**Interfaces:**
- Consumes: API local com seed, `E2E_EMAIL`/`E2E_PASSWORD` já existentes (para o caso de e-mail já usado).

- [ ] **Step 1: Escrever os testes Playwright**

```ts
test('creates an account and lands logged in', ...);          // e-mail único por execução (Date.now()), fica em "/" com "Olá, <nome>." e sobrevive a um reload
test('shows an error when the e-mail is already used', ...);  // usa E2E_EMAIL
test('rejects a weak password without calling the API', ...); // sem chamada de rede ao /register (page.route conta)
test('login and signup link to each other', ...);
test('a new account can log out and log in again', ...);
```

- [ ] **Step 2: Rodar localmente e ver passar**

Subir Postgres (já no ar), migrar, semear o admin do e2e e a API em porta livre com `THROTTLE_DISABLED=true`, rodar `VITE_API_TARGET=... E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e` em `apps/web`. Tudo passa; todos os processos iniciados são encerrados no fim. Falha aqui é bug real: corrigir no código da task que causou, num commit `fix(...)`.

- [ ] **Step 3: CI e docs**

No job `web`, definir `THROTTLE_DISABLED: 'true'` no passo que inicia a API do e2e. `docs/DEPLOY.md`: seção sobre `TRUST_PROXY` (como escolher o número de saltos, e conferir depois do deploy que o limite é por visitante e não global) e sobre `THROTTLE_DISABLED` ser só para testes.

- [ ] **Step 4: Verificar tudo e commitar**

Run no `apps/web`: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`; no `apps/api`: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e`.
```bash
git commit -m "test(web): cover signup end to end"
git commit -m "ci: disable throttling in the web e2e API"
git commit -m "docs: explain trust proxy and throttling for deploy"
```
