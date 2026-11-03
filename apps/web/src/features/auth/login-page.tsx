import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { BrandMark } from '../../shared/ui/brand-mark';
import { Button } from '../../shared/ui/button';
import { PasswordField } from '../../shared/ui/password-field';
import { TextField } from '../../shared/ui/text-field';
import { loginSchema, type LoginValues } from './login-schema';
import { safeRedirect } from './safe-redirect';
import { useAuth } from './use-auth';

const SERVER_ERRORS = {
  invalid: 'E-mail ou senha incorretos.',
  'rate-limited': 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  unavailable: 'Não foi possível entrar. Tente de novo.',
} as const;

type LoginPageProps = {
  /** The `redirect` search param, untrusted until `safeRedirect` cleans it. */
  redirect?: string;
  navigate: (to: string) => void;
};

export function LoginPage({ redirect, navigate }: LoginPageProps) {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async ({ email, password }: LoginValues) => {
    if (busy.current) return;
    busy.current = true;
    setServerError(null);
    try {
      const result = await login(email, password);
      if (result === 'ok') navigate(safeRedirect(redirect));
      else setServerError(SERVER_ERRORS[result]);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="flex min-h-screen flex-wrap gap-4 bg-white p-4">
      <section className="flex min-h-[600px] flex-[1_1_420px] flex-col overflow-hidden rounded-[36px] bg-brand px-11 pt-10">
        <BrandMark />
        <div className="flex flex-1 flex-col justify-center pt-12 pb-6">
          <h2 className="max-w-[400px] font-display text-5xl leading-[1.04] font-semibold tracking-[-0.03em] text-balance text-white">
            O sistema que você ama oferecer.
          </h2>
          <p className="mt-5 max-w-[340px] text-[17px] leading-normal font-medium text-white">
            Chamados, conversas e prioridades da sua equipe de suporte em um só
            lugar.
          </p>
        </div>
        <img
          src="/ilustra-login.png"
          alt="Ilustração de atendente com notebook"
          className="-mr-2 block w-80 max-w-[80%] self-end"
        />
      </section>
      <section className="flex flex-[1_1_420px] items-center justify-center px-6 py-10">
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full max-w-[400px] flex-col gap-5"
        >
          <div className="mb-2 flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink">
              Bem-vindo de volta
            </h1>
            <p className="text-[15px] text-secondary">
              Entre para continuar seus atendimentos.
            </p>
          </div>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com.br"
            error={errors.email?.message}
            {...register('email')}
          />
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            placeholder="Sua senha"
            error={errors.password?.message}
            {...register('password')}
          />
          {serverError ? (
            <p role="alert" className="text-[13px] text-danger">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
          <p className="mt-1 text-center text-[14.5px] text-secondary">
            Ainda não tem conta?{' '}
            <Link
              to="/cadastro"
              search={redirect ? { redirect } : {}}
              className="rounded-sm font-semibold text-link outline-none hover:underline focus-visible:ring-4 focus-visible:ring-focus"
            >
              Criar conta
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
