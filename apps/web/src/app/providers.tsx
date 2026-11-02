import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/auth-provider';
import { AppRouter, createAppRouter } from './router';

export function Providers() {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createAppRouter());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
