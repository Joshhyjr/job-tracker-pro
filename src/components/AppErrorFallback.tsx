interface AppErrorFallbackProps {
  resetError: () => void;
}

export function AppErrorFallback({ resetError }: AppErrorFallbackProps) {
  // Present a recovery path without exposing exception details or private application data.
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground" role="alert">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The application stopped unexpectedly. Try loading it again.
        </p>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={resetError}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
