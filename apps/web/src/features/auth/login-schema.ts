import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .pipe(z.email('Digite um e-mail válido, como nome@empresa.com.br.')),
  password: z.string().min(1, 'Informe sua senha.'),
});

export type LoginValues = z.infer<typeof loginSchema>;
