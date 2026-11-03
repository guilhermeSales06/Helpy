import { z } from 'zod';

export const PASSWORD_RULES = [
  { label: '8+ caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Um número', test: (p: string) => /\d/.test(p) },
] as const;

export function passwordRules(
  password: string,
): { label: string; ok: boolean }[] {
  return PASSWORD_RULES.map(({ label, test }) => ({
    label,
    ok: test(password),
  }));
}

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(120, 'O nome pode ter no máximo 120 caracteres.')
      .refine((n) => n.split(/\s+/).length >= 2, 'Informe nome e sobrenome.'),
    email: z.string().trim().pipe(z.email('Digite um e-mail válido.')),
    password: z
      .string()
      .refine(
        (p) => passwordRules(p).every((r) => r.ok),
        'A senha ainda não atende a todos os requisitos.',
      ),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export type SignupValues = z.infer<typeof signupSchema>;
