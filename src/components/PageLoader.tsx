import { Loader2 } from 'lucide-react';

/**
 * Full-page loading spinner for Suspense fallback
 * Used when lazy-loaded pages are being fetched
 */
export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="text-center">
        <Loader2
          className="mx-auto mb-4 h-8 w-8 animate-spin text-primary-strong"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
