import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';
import type { LoginResult } from './use-auth';

const login =
  vi.fn<(email: string, password: string) => Promise<LoginResult>>();

vi.mock('./use-auth', () => ({ useAuth: () => ({ login }) }));

const navigate = vi.fn();

function setup(redirect?: string) {
  render(<LoginPage redirect={redirect} navigate={navigate} />);
  return {
    user: userEvent.setup(),
    email: screen.getByLabelText('E-mail'),
    password: screen.getByLabelText('Senha'),
    submit: screen.getByRole('button', { name: 'Entrar' }),
  };
}

beforeEach(() => {
  login.mockReset();
  navigate.mockReset();
});

describe('LoginPage', () => {
  it('requires an email', async () => {
    const { user, password, email, submit } = setup();
    await user.type(password, 'x');
    await user.click(submit);
    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a bad email', async () => {
    const { user, email, password, submit } = setup();
    await user.type(email, 'nope');
    await user.type(password, 'x');
    await user.click(submit);
    expect(
      await screen.findByText(
        'Digite um e-mail válido, como nome@empresa.com.br.',
      ),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('requires a password', async () => {
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.click(submit);
    expect(await screen.findByText('Informe sua senha.')).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('does not enforce a password length on login', async () => {
    login.mockResolvedValue('ok');
    const { user, email, password } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'a');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('ana@helpy.test', 'a'),
    );
  });

  it('navigates to the safe redirect after login', async () => {
    login.mockResolvedValue('ok');
    const { user, email, password, submit } = setup('/chamados');
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/chamados'));
  });

  it('falls back to / for an unsafe redirect', async () => {
    login.mockResolvedValue('ok');
    const { user, email, password, submit } = setup('https://evil.com');
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('shows "Entrando…" and blocks a second submit while waiting', async () => {
    let resolve!: (r: LoginResult) => void;
    login.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    const busy = await screen.findByRole('button', { name: 'Entrando…' });
    expect(busy).toBeDisabled();
    await user.keyboard('{Enter}');
    await user.click(busy);
    expect(login).toHaveBeenCalledTimes(1);
    resolve('invalid');
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('shows "E-mail ou senha incorretos." on invalid and keeps the email', async () => {
    login.mockResolvedValue('invalid');
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    expect(
      await screen.findByText('E-mail ou senha incorretos.'),
    ).toBeInTheDocument();
    expect(email).toHaveValue('ana@helpy.test');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows "Não foi possível entrar. Tente de novo." on unavailable', async () => {
    login.mockResolvedValue('unavailable');
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    expect(
      await screen.findByText('Não foi possível entrar. Tente de novo.'),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows "Muitas tentativas. Aguarde um minuto e tente de novo." on rate-limited', async () => {
    login.mockResolvedValue('rate-limited');
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    expect(
      await screen.findByText(
        'Muitas tentativas. Aguarde um minuto e tente de novo.',
      ),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('toggles password visibility with an accessible label', async () => {
    const { user, password } = setup();
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('ties each error to its input via aria-describedby and aria-invalid', async () => {
    const { user, email, password, submit } = setup();
    await user.click(submit);
    await screen.findByText('Informe seu e-mail.');
    for (const [input, text] of [
      [email, 'Informe seu e-mail.'],
      [password, 'Informe sua senha.'],
    ] as const) {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(text);
    }
  });

  it('announces the server error as an alert', async () => {
    login.mockResolvedValue('invalid');
    const { user, email, password, submit } = setup();
    await user.type(email, 'ana@helpy.test');
    await user.type(password, 'secret');
    await user.click(submit);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('has the expected copy and autocomplete', () => {
    const { email, password } = setup();
    expect(
      screen.getByRole('heading', { name: 'Bem-vindo de volta' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Entre para continuar seus atendimentos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText('Ilustração de atendente com notebook'),
    ).toBeInTheDocument();
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(email).toHaveAttribute('placeholder', 'nome@empresa.com.br');
    expect(password).toHaveAttribute('placeholder', 'Sua senha');
  });

  it('shows no Google, Apple, forgot password or sign up controls', () => {
    setup();
    expect(screen.queryByText(/google|apple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/esqueci/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/criar conta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ou continue com/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
