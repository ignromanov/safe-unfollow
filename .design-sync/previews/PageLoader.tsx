import { PageLoader } from 'safe-unfollow';

// PageLoader relies on a flex-1 parent with real height (it's the Suspense
// fallback for lazy-loaded routes) — give it one so it actually fills.
export function Default() {
  return (
    <div className="flex h-72 w-full max-w-md flex-col rounded-2xl border border-border">
      <PageLoader />
    </div>
  );
}
