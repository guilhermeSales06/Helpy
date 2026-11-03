import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_EMAIL;
if (!adminEmail) {
  throw new Error('Set E2E_EMAIL (the seeded admin) to run the e2e tests.');
}

const PASSWORD = 'Senha1234';
const NAME = 'Maria Souza';

const uniqueEmail = () =>
  `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@helpy.test`;

const profileMenu = (page: Page) =>
  page.getByRole('button', { name: /Cliente/ });

async function fillSignup(
  page: Page,
  { email, password = PASSWORD }: { email: string; password?: string },
) {
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill(NAME);
  await page.getByLabel('E-mail corporativo').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
}

test('creates an account and lands logged in', async ({ page }) => {
  await fillSignup(page, { email: uniqueEmail() });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'Olá, Maria.' }),
  ).toBeVisible();
  await expect(profileMenu(page)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Olá, Maria.' }),
  ).toBeVisible();
  await expect(profileMenu(page)).toBeVisible();
});

test('shows an error when the e-mail is already used', async ({ page }) => {
  await fillSignup(page, { email: adminEmail! });

  await expect(
    page.getByLabel('E-mail corporativo'),
  ).toHaveAccessibleDescription('Já existe uma conta com este e-mail.');
  await expect(page).toHaveURL(/\/cadastro/);
});

test('rejects a weak password without calling the API', async ({ page }) => {
  let registerCalls = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/register')) registerCalls += 1;
  });

  await fillSignup(page, { email: uniqueEmail(), password: 'senhafraca' });

  await expect(
    page.getByText('A senha ainda não atende a todos os requisitos.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/cadastro/);
  expect(registerCalls).toBe(0);
});

test('login and signup link to each other', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/cadastro/);
  await expect(
    page.getByRole('heading', { name: 'Crie sua conta' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('a new account can log out and log in again', async ({ page }) => {
  const email = uniqueEmail();
  await fillSignup(page, { email });
  await expect(profileMenu(page)).toBeVisible();

  await profileMenu(page).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(profileMenu(page)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Olá, Maria.' }),
  ).toBeVisible();
});
