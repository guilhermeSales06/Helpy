import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (!email || !password) {
  throw new Error(
    'Set E2E_EMAIL and E2E_PASSWORD (the seeded admin) to run the e2e tests.',
  );
}

async function login(page: Page, pass = password!) {
  await page.getByLabel('E-mail').fill(email!);
  await page.getByLabel('Senha', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const profileMenu = (page: Page) =>
  page.getByRole('button', { name: /Administrador/ });

async function expectAuthenticated(page: Page) {
  await expect(profileMenu(page)).toBeVisible();
}

test('logs in, survives a reload and logs out', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await login(page);
  await expectAuthenticated(page);

  await page.reload();
  await expectAuthenticated(page);

  await profileMenu(page).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('shows an error for a wrong password', async ({ page }) => {
  await page.goto('/login');
  await login(page, `${password}-wrong`);
  await expect(page.getByRole('alert')).toHaveText(
    'E-mail ou senha incorretos.',
  );
  await expect(page).toHaveURL(/\/login/);
});

test('returns to the requested page after login', async ({ page }) => {
  await page.goto('/?tab=1');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/?tab=1');

  await login(page);
  await expectAuthenticated(page);
  await expect(page).toHaveURL(/\/\?tab=1$/);
});

test('two tabs reloading together both stay logged in', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/login');
  await login(first);
  await expectAuthenticated(first);

  const second = await context.newPage();
  await second.goto('/');
  await expectAuthenticated(second);

  // Both tabs lose their in-memory token and refresh at the same time. A
  // refresh token reused by the second tab would revoke every session.
  await Promise.all([first.reload(), second.reload()]);
  await expectAuthenticated(first);
  await expectAuthenticated(second);

  await Promise.all([first.reload(), second.reload()]);
  await expectAuthenticated(first);
  await expectAuthenticated(second);

  await first.reload();
  await expectAuthenticated(first);
});

test('a deleted refresh cookie sends the user back to login', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await login(page);
  await expectAuthenticated(page);

  await context.clearCookies({ name: 'refresh_token' });
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
