import { useAuth } from '../features/auth/use-auth';

export function HomePage() {
  const { state } = useAuth();
  const name = state.status === 'authenticated' ? state.user.name : '';
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">
        Olá, {firstName}.
      </h1>
      <p className="mt-2 text-[15px] text-secondary">
        Seus chamados vão aparecer aqui.
      </p>
    </div>
  );
}
