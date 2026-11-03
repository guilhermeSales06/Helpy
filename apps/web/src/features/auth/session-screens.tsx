export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas">
      <p role="status" className="text-muted">
        Carregando…
      </p>
    </main>
  );
}

export function UnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="font-display text-xl text-ink">
          Não foi possível conectar ao Helpy.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
