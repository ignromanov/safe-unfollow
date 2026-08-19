import { ErrorBoundary } from 'safe-unfollow';

// ErrorBoundary's own box renders nothing when there is no error — its useful story is the
// caught-error fallback, so every card here wraps a child that throws during render.
function BrokenChild(): never {
  throw new Error('Simulated render error for preview');
}

export function DefaultFallback() {
  return (
    <ErrorBoundary>
      <BrokenChild />
    </ErrorBoundary>
  );
}

export function CustomFallback() {
  return (
    <ErrorBoundary
      fallback={
        <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="font-bold text-lg mb-2">This section couldn&apos;t load</p>
          <p className="text-muted-foreground text-sm">
            Try refreshing the page. Your data stays in your browser either way.
          </p>
        </div>
      }
    >
      <BrokenChild />
    </ErrorBoundary>
  );
}
