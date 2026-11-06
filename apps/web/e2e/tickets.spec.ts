import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  openTicket,
  seedTickets,
  type Account,
  type SeededTicket,
} from './support/seed-tickets';

async function login(page: Page, { email, password }: Account) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('link', { name: 'Visão geral' })).toBeVisible();
}

async function loginAsAdmin(page: Page) {
  await login(page, {
    name: 'Administrador',
    email: process.env.E2E_EMAIL!,
    password: process.env.E2E_PASSWORD!,
  });
}

/** A technician in a browser of their own, so two can act at once. */
async function technicianPage(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, account);
  return { context, page };
}

async function openDetail(page: Page, ticket: SeededTicket) {
  await page.goto(`/chamados/${ticket.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: ticket.title }),
  ).toBeVisible();
}

const status = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).first();

const row = (page: Page, ticket: SeededTicket) =>
  page.getByRole('row').filter({ hasText: ticket.title });

async function take(page: Page, ticket: SeededTicket) {
  await openDetail(page, ticket);
  await page.getByRole('button', { name: 'Assumir' }).click();
  await expect(status(page, 'Em andamento')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Devolver à fila' }),
  ).toBeVisible();
}

test.describe('tickets', () => {
  test('a technician takes a ticket from the queue and sees it under Meus chamados', async ({
    page,
  }) => {
    const { technician, tickets } = await seedTickets();
    await login(page, technician);

    await page.getByRole('link', { name: 'Não atribuídos' }).click();
    await expect(page).toHaveURL(/assignee=none/);
    await expect(row(page, tickets.open)).toBeVisible();
    // The other area's ticket is not in this technician's queue.
    await expect(row(page, tickets.otherAreaOpen)).toHaveCount(0);

    await page.getByRole('link', { name: tickets.open.title }).click();
    await expect(page).toHaveURL(new RegExp(`/chamados/${tickets.open.id}`));
    await expect(status(page, 'Aberto')).toBeVisible();
    await page.getByRole('button', { name: 'Assumir' }).click();
    await expect(status(page, 'Em andamento')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assumir' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Devolver à fila' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Meus chamados' }).click();
    await expect(page).toHaveURL(/assignee=me/);
    await expect(row(page, tickets.open)).toBeVisible();
    await expect(row(page, tickets.open)).toContainText('Em andamento');
    await expect(row(page, tickets.open)).toContainText(technician.name);
  });

  test('a technician returns a ticket to the queue and another technician can take it', async ({
    page,
    browser,
  }) => {
    const { technician, otherTechnician, tickets } = await seedTickets();
    await login(page, technician);
    await take(page, tickets.open);

    await page.getByRole('button', { name: 'Devolver à fila' }).click();
    await page.getByRole('button', { name: 'Devolver', exact: true }).click();
    await expect(status(page, 'Aberto')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assumir' })).toBeVisible();

    const other = await technicianPage(browser, otherTechnician);
    try {
      await take(other.page, tickets.open);
      await expect(
        other.page.getByRole('complementary', { name: 'Propriedades' }),
      ).toContainText(otherTechnician.name);
    } finally {
      await other.context.close();
    }
  });

  test('marking pending and resuming changes the status badge', async ({
    page,
  }) => {
    const { technician, tickets } = await seedTickets();
    await login(page, technician);
    await take(page, tickets.open);

    await page.getByRole('button', { name: 'Marcar como pendente' }).click();
    await expect(status(page, 'Pendente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retomar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resolver' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(status(page, 'Em andamento')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Marcar como pendente' }),
    ).toBeVisible();
  });

  test('resolving a ticket shows Resolvido and offers Reabrir', async ({
    page,
  }) => {
    const { technician, tickets } = await seedTickets();
    await login(page, technician);
    await take(page, tickets.open);

    await page.getByRole('button', { name: 'Resolver' }).click();
    await expect(status(page, 'Resolvido')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reabrir' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resolver' })).toHaveCount(0);

    await page.reload();
    await expect(status(page, 'Resolvido')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reabrir' })).toBeVisible();
  });

  test('search by title and by #number finds the ticket; a technician does not find a ticket of another area', async ({
    page,
  }) => {
    const { run, technician, tickets } = await seedTickets();
    await login(page, technician);
    const search = page.getByRole('searchbox', { name: 'Pesquisar chamados' });

    // Both tickets carry the run's text; only one is in this technician's area.
    await search.fill(run.toUpperCase());
    await search.press('Enter');
    await expect(page).toHaveURL(/q=/);
    await expect(row(page, tickets.open)).toBeVisible();
    await expect(row(page, tickets.otherAreaOpen)).toHaveCount(0);

    await search.fill(`#${tickets.open.number}`);
    await search.press('Enter');
    await expect(row(page, tickets.open)).toBeVisible();

    // Not even its number reveals a ticket outside the technician's areas.
    await search.fill(`#${tickets.otherAreaOpen.number}`);
    await search.press('Enter');
    await expect(page.getByText('Nenhum chamado encontrado')).toBeVisible();
    await expect(row(page, tickets.otherAreaOpen)).toHaveCount(0);
  });

  test('filters and sort live in the URL and survive a reload', async ({
    page,
  }) => {
    const scenario = await seedTickets();
    const { technician, category, tickets } = scenario;
    const urgent = await openTicket(
      scenario,
      category.id,
      `Servidor ${scenario.run}`,
      'HIGH',
    );
    await login(page, technician);

    await page.getByRole('link', { name: 'Não atribuídos' }).click();
    await expect(row(page, tickets.open)).toBeVisible();
    await expect(row(page, urgent)).toBeVisible();

    await page.getByRole('button', { name: /Ordenar por/ }).click();
    await page.getByRole('menuitemradio', { name: 'Maior prioridade' }).click();
    await expect(page).toHaveURL(/sort=priority/);
    // Highest priority first: the first body row is the HIGH one.
    await expect(page.getByRole('row').nth(1)).toContainText(urgent.title);

    await page.getByRole('button', { name: /Prioridade/ }).click();
    await page.getByRole('menuitemradio', { name: 'Alta' }).click();
    await expect(page).toHaveURL(/priority=HIGH/);
    await expect(page).toHaveURL(/sort=priority/);
    await expect(page).toHaveURL(/assignee=none/);
    await expect(row(page, urgent)).toBeVisible();
    await expect(row(page, tickets.open)).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/priority=HIGH/);
    await expect(page).toHaveURL(/sort=priority/);
    await expect(row(page, urgent)).toBeVisible();
    await expect(row(page, tickets.open)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /Prioridade/ }),
    ).toContainText('Alta');
    await expect(
      page.getByRole('button', { name: /Ordenar por/ }),
    ).toContainText('Maior prioridade');
  });

  test('an admin sees all tickets, assigns one to a technician and cannot take it', async ({
    page,
  }) => {
    const { run, technician, tickets } = await seedTickets();
    await loginAsAdmin(page);

    await page.getByRole('link', { name: 'Todos os chamados' }).click();
    await page.getByRole('searchbox', { name: 'Pesquisar chamados' }).fill(run);
    await page
      .getByRole('searchbox', { name: 'Pesquisar chamados' })
      .press('Enter');
    // Every area, unlike the technician's view.
    await expect(row(page, tickets.open)).toBeVisible();
    await expect(row(page, tickets.otherAreaOpen)).toBeVisible();

    await page.getByRole('link', { name: tickets.open.title }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: tickets.open.title }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assumir' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Devolver à fila' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Atribuir' }).click();
    await page.getByRole('menuitemradio', { name: technician.name }).click();
    await expect(
      page.getByRole('complementary', { name: 'Propriedades' }),
    ).toContainText(technician.name);
    await expect(page.getByRole('button', { name: 'Assumir' })).toHaveCount(0);

    // The ticket is still open, now with a technician: the admin may start it.
    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(status(page, 'Em andamento')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Iniciar atendimento' }),
    ).toHaveCount(0);
  });

  test('an unknown ticket id shows the not found page', async ({ page }) => {
    const { technician, tickets } = await seedTickets();
    await login(page, technician);

    await page.goto('/chamados/00000000-0000-4000-8000-000000000000');
    await expect(
      page.getByRole('heading', { name: 'Chamado não encontrado' }),
    ).toBeVisible();

    // A ticket outside the technician's areas looks the same as a missing one.
    await page.goto(`/chamados/${tickets.otherAreaOpen.id}`);
    await expect(
      page.getByRole('heading', { name: 'Chamado não encontrado' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Voltar para a lista' }).click();
    await expect(page).toHaveURL(/\/chamados/);
  });

  test('two technicians taking the same ticket: one succeeds, the other is left on the not found page', async ({
    browser,
  }) => {
    const { technician, otherTechnician, tickets } = await seedTickets();
    const first = await technicianPage(browser, technician);
    const second = await technicianPage(browser, otherTechnician);
    try {
      // Both have the ticket open and offered before either one clicks.
      await openDetail(first.page, tickets.open);
      await openDetail(second.page, tickets.open);
      const takeFirst = first.page.getByRole('button', { name: 'Assumir' });
      const takeSecond = second.page.getByRole('button', { name: 'Assumir' });
      await expect(takeFirst).toBeEnabled();
      await expect(takeSecond).toBeEnabled();

      await Promise.all([takeFirst.click(), takeSecond.click()]);

      // The loser's take answers 409 and the reload that follows finds the
      // ticket gone from its queue, so its page turns into "not found" (with
      // no reload by the test). Exactly one of the two pages ends up there.
      const notFound = [first.page, second.page].map((p) =>
        p.getByRole('heading', { name: 'Chamado não encontrado' }),
      );
      await expect(async () => {
        const counts = await Promise.all(notFound.map((h) => h.count()));
        expect([...counts].sort()).toEqual([0, 1]);
      }).toPass();

      const [winner, loser] =
        (await notFound[0].count()) === 0
          ? [
              { ...first, who: technician },
              { ...second, who: otherTechnician },
            ]
          : [
              { ...second, who: otherTechnician },
              { ...first, who: technician },
            ];

      await expect(status(winner.page, 'Em andamento')).toBeVisible();
      await expect(
        winner.page.getByRole('button', { name: 'Devolver à fila' }),
      ).toBeVisible();
      await expect(winner.page.getByRole('alert')).toHaveCount(0);

      // The ticket is the winner's now, so it left the loser's queue: reading
      // it again is "not found", and only the winner is its technician.
      await expect(
        winner.page.getByRole('complementary', { name: 'Propriedades' }),
      ).toContainText(winner.who.name);
      await expect(
        loser.page.getByRole('heading', { name: 'Chamado não encontrado' }),
      ).toBeVisible();
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });
});
