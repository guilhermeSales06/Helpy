import { createContext, useContext } from 'react';
import type { components } from '../../shared/api/schema';

export type User = components['schemas']['UserResponseDto'];

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User };

export type LoginResult = 'ok' | 'invalid' | 'unavailable';

export type AuthContextValue = {
  state: AuthState;
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  retry(): void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
