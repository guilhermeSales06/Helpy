import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupPage } from './signup-page';
import type { RegisterInput, RegisterResult } from './use-auth';

const register = vi.fn<(input: RegisterInput) => Promise<RegisterResult>>();

vi.mock('./use-auth', () => ({ useAuth: () => ({ register }) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const navigate = vi.fn();

function setup(redirect?: string) {
  render(<SignupPage redirect={redirect} navigate={navigate} />);
  return {
    user: userEvent.setup(),
    name: screen.getByLabelText('Nome completo'),
    email: screen.getByLabelText('E-mail corporativo'),
    password: screen.getByLabelText('Senha'),
    confirm: screen.getByLabelText('Confirmar senha'),
    submit: screen.getByRole('button', { name: 'Criar conta' }),
  };
}

type Fields = ReturnType<typeof setup>;

async function fill(f: Fields, password = 'Senha123') {
  await f.user.type(f.name, 'Ana Souza');
  await f.user.type(f.email, '  ana@helpy.test ');
  await f.user.type(f.password, password);
  await f.user.type(f.confirm, password);
}

beforeEach(() => {
  register.mockReset();
  navigate.mockReset();
});

describe('SignupPage', () => {
  it('shows the three password rules and turns each green as they are met', async () => {
    const f = setup();
    const rule = (name: string) => screen.getByText(name).closest('li')!;
    for (const label of ['8+ caracteres', 'Uma letra maiúscula', 'Um número']) {
      expect(rule(label)).toHaveAttribute('data-ok', 'false');
    }
    await f.user.type(f.password, 'A');
    expect(rule('Uma letra maiúscula')).toHaveAttribute('data-ok', 'true');
    expect(rule('Um número')).toHaveAttribute('data-ok', 'false');
    await f.user.type(f.password, '1bcdefg');
    for (const label of ['8+ caracteres', 'Uma letra maiúscula', 'Um número']) {
      expect(rule(label)).toHaveAttribute('data-ok', 'true');
    }
  });

  it('toggles "Mostrar senhas" for both password fields', async () => {
    const f = setup();
    expect(f.password).toHaveAttribute('type', 'password');
    expect(f.confirm).toHaveAttribute('type', 'password');
    await f.user.click(screen.getByLabelText('Mostrar senhas'));
    expect(f.password).toHaveAttribute('type', 'text');
    expect(f.confirm).toHaveAttribute('type', 'text');
    await f.user.click(screen.getByLabelText('Mostrar senhas'));
    expect(f.password).toHaveAttribute('type', 'password');
    expect(f.confirm).toHaveAttribute('type', 'password');
  });

  it('submits name, trimmed e-mail and password, and navigates to safeRedirect(redirect) on ok', async () => {
    register.mockResolvedValue('ok');
    const f = setup('/chamados');
    await fill(f);
    await f.user.click(f.submit);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/chamados'));
    expect(register).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@helpy.test',
      password: 'Senha123',
    });
  });

  it('falls back to / for an unsafe redirect', async () => {
    register.mockResolvedValue('ok');
    const f = setup('https://site-externo.com');
    await fill(f);
    await f.user.click(f.submit);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('shows "Já existe uma conta com este e-mail." on email-taken and keeps what was typed', async () => {
    register.mockResolvedValue('email-taken');
    const f = setup();
    await fill(f);
    await f.user.click(f.submit);
    const message = 'Já existe uma conta com este e-mail.';
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(f.email).toHaveAttribute('aria-invalid', 'true');
    expect(f.email).toHaveAccessibleDescription(message);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(f.name).toHaveValue('Ana Souza');
    expect(f.email).toHaveValue('ana@helpy.test');
    expect(f.password).toHaveValue('Senha123');
    expect(f.confirm).toHaveValue('Senha123');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the e-mail taken error when the e-mail is edited', async () => {
    register.mockResolvedValue('email-taken');
    const f = setup();
    await fill(f);
    await f.user.click(f.submit);
    await screen.findByText('Já existe uma conta com este e-mail.');
    await f.user.clear(f.email);
    await f.user.type(f.email, 'outra@helpy.test');
    await waitFor(() =>
      expect(
        screen.queryByText('Já existe uma conta com este e-mail.'),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(f.email).not.toHaveAttribute('aria-invalid'));
  });

  it.each([
    ['rate-limited', 'Muitas tentativas. Aguarde um minuto e tente de novo.'],
    ['unavailable', 'Não foi possível criar a conta. Tente de novo.'],
    ['invalid', 'Revise os dados e tente de novo.'],
  ] as const)('shows the message for %s', async (result, text) => {
    register.mockResolvedValue(result);
    const f = setup();
    await fill(f);
    await f.user.click(f.submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blocks a second submit while waiting and shows "Criando conta…"', async () => {
    let resolve!: (r: RegisterResult) => void;
    register.mockReturnValue(new Promise((r) => (resolve = r)));
    const f = setup();
    await fill(f);
    await f.user.click(f.submit);
    const busy = await screen.findByRole('button', { name: 'Criando conta…' });
    expect(busy).toBeDisabled();
    await f.user.keyboard('{Enter}');
    await f.user.click(busy);
    expect(register).toHaveBeenCalledTimes(1);
    resolve('invalid');
    expect(
      await screen.findByRole('button', { name: 'Criar conta' }),
    ).toBeEnabled();
  });

  it('ties each error to its input with aria-describedby and aria-invalid', async () => {
    const f = setup();
    await f.user.type(f.name, 'Ana');
    await f.user.type(f.email, 'nope');
    await f.user.type(f.password, 'abc');
    await f.user.type(f.confirm, 'xyz');
    await f.user.click(f.submit);
    await screen.findByText('Informe nome e sobrenome.');
    for (const [input, text] of [
      [f.name, 'Informe nome e sobrenome.'],
      [f.email, 'Digite um e-mail válido.'],
      [f.password, 'A senha ainda não atende a todos os requisitos.'],
      [f.confirm, 'As senhas não coincidem.'],
    ] as const) {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(text);
    }
    expect(register).not.toHaveBeenCalled();
  });

  it('has the expected copy and autocomplete', () => {
    const f = setup();
    expect(
      screen.getByRole('heading', { name: 'Crie sua conta' }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText('Ilustração de atendente pensativa com notebook'),
    ).toBeInTheDocument();
    expect(f.name).toHaveAttribute('autocomplete', 'name');
    expect(f.email).toHaveAttribute('autocomplete', 'email');
    expect(f.password).toHaveAttribute('autocomplete', 'new-password');
    expect(f.confirm).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows the demo notice and no Google, Apple, terms or privacy controls', () => {
    setup();
    expect(
      screen.getByText(
        'Este é um ambiente de demonstração: os dados são públicos e apagados periodicamente.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/google|apple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/termos|privacidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ou cadastre-se/i)).not.toBeInTheDocument();
  });

  it('links back to the login page', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
