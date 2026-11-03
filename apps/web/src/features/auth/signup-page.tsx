import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { BrandMark } from '../../shared/ui/brand-mark';
import { Button } from '../../shared/ui/button';
import { PasswordField } from '../../shared/ui/password-field';
import { TextField } from '../../shared/ui/text-field';
import { PasswordRequirements } from './password-requirements';
import { signupSchema, type SignupValues } from './signup-schema';
import { safeRedirect } from './safe-redirect';
import { useAuth } from './use-auth';

const EMAIL_TAKEN = 'Já existe uma conta com este e-mail.';

const SERVER_ERRORS = {
  'rate-limited': 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  invalid: 'Revise os dados e tente de novo.',
  unavailable: 'Não foi possível criar a conta. Tente de novo.',
} as const;

type SignupPageProps = {
  /** The `redirect` search param, untrusted until `safeRedirect` cleans it. */
  redirect?: string;
  navigate: (to: string) => void;
};

export function SignupPage({ redirect, navigate }: SignupPageProps) {
  const { register: registerAccount } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });
  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = async ({ name, email, password }: SignupValues) => {
    if (busy.current) return;
    busy.current = true;
    setServerError(null);
    try {
      const result = await registerAccount({ name, email, password });
      if (result === 'ok') navigate(safeRedirect(redirect));
      else if (result === 'email-taken') {
        setError('email', { type: 'server', message: EMAIL_TAKEN });
      } else setServerError(SERVER_ERRORS[result]);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="flex min-h-screen flex-wrap-reverse gap-4 bg-white p-4">
      <section className="flex flex-[1.3_1_480px] items-center justify-center px-6 py-10">
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full max-w-[480px] flex-col gap-[18px]"
        >
          <div className="mb-1 flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink">
              Crie sua conta
            </h1>
            <p className="text-[15px] text-secondary">
              Leva menos de um minuto para começar a atender.
            </p>
          </div>
          <TextField
            label="Nome completo"
            autoComplete="name"
            placeholder="Como você quer ser chamado"
            error={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="E-mail corporativo"
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com.br"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-start gap-3.5">
            <PasswordField
              label="Senha"
              autoComplete="new-password"
              placeholder="Crie uma senha"
              reveal={showPasswords}
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              label="Confirmar senha"
              autoComplete="new-password"
              placeholder="Repita a senha"
              reveal={showPasswords}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2">
            <PasswordRequirements password={password} />
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[13px] text-secondary">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="size-4 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              Mostrar senhas
            </label>
          </div>
          {serverError ? (
            <p role="alert" className="text-[13px] text-danger">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
          <p className="text-center text-[12.5px] text-muted">
            Este é um ambiente de demonstração: os dados são públicos e apagados
            periodicamente.
          </p>
          <p className="mt-1 text-center text-[14.5px] text-secondary">
            Já tem uma conta?{' '}
            <Link
              to="/login"
              search={redirect ? { redirect } : {}}
              className="rounded-sm font-semibold text-link outline-none hover:underline focus-visible:ring-4 focus-visible:ring-focus"
            >
              Entrar
            </Link>
          </p>
        </form>
      </section>
      <section className="flex min-h-[600px] flex-[1_1_380px] flex-col overflow-hidden rounded-[36px] bg-brand px-10 pt-10">
        <BrandMark />
        <h2 className="mt-14 max-w-[340px] font-display text-[40px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance text-white">
          O sistema que você ama oferecer.
        </h2>
        <img
          src="/ilustra-cadastro.png"
          alt="Ilustração de atendente pensativa com notebook"
          className="mt-auto block w-70 max-w-[80%] self-center"
        />
      </section>
    </div>
  );
}
