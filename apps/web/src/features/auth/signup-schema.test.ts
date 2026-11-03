import { describe, expect, it } from 'vitest';
import { passwordRules, signupSchema } from './signup-schema';

const valid = {
  name: 'Ana Souza',
  email: 'ana@helpy.test',
  password: 'Senha123',
  confirmPassword: 'Senha123',
};

function messages(input: Record<string, string>) {
  const result = signupSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('signupSchema', () => {
  it.each([['Ana'], ['  Ana  '], ['']])(
    'rejects a name without surname: %j',
    (name) => {
      expect(messages({ ...valid, name })).toContain(
        'Informe nome e sobrenome.',
      );
    },
  );

  it('accepts two or more words', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
    expect(
      signupSchema.safeParse({ ...valid, name: 'Ana Maria de Souza' }).success,
    ).toBe(true);
  });

  it('rejects a bad e-mail', () => {
    expect(messages({ ...valid, email: 'nope' })).toContain(
      'Digite um e-mail válido.',
    );
    expect(messages({ ...valid, email: '' })).toContain(
      'Digite um e-mail válido.',
    );
  });

  it.each([
    ['Senha12'],
    ['senha1234'],
    ['SenhaSenha'],
    ['Éabcdef1'],
    ['éabcdef1'],
  ])('rejects a password that fails any rule: %j', (password) => {
    expect(
      messages({ ...valid, password, confirmPassword: password }),
    ).toContain('A senha ainda não atende a todos os requisitos.');
  });

  it('accepts a password that meets every rule', () => {
    expect(
      signupSchema.safeParse({
        ...valid,
        password: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }).success,
    ).toBe(true);
  });

  it('only counts A-Z as uppercase, like the API', () => {
    expect(passwordRules('Éabcdef1')[1].ok).toBe(false);
  });

  it('rejects confirmation that differs', () => {
    expect(messages({ ...valid, confirmPassword: 'Senha124' })).toEqual([
      'As senhas não coincidem.',
    ]);
  });

  it('passwordRules reflects each rule live', () => {
    expect(passwordRules('')).toEqual([
      { label: '8+ caracteres', ok: false },
      { label: 'Uma letra maiúscula', ok: false },
      { label: 'Um número', ok: false },
    ]);
    expect(passwordRules('Abc').map((r) => r.ok)).toEqual([false, true, false]);
    expect(passwordRules('abcdefg1').map((r) => r.ok)).toEqual([
      true,
      false,
      true,
    ]);
    expect(passwordRules('Abcdefg1').every((r) => r.ok)).toBe(true);
  });
});
