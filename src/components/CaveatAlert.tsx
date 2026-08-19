import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

/**
 * The shell every `/results` caveat is rendered in.
 *
 * There are two of them — `FollowRequestsCaveat` (GH#41) and
 * `TruncatedFileCaveat` — and they said the same thing about themselves twice:
 * the same amber palette across four `className` strings, the same warning
 * icon, and the same `role="status"`.
 *
 * That last one is why this file exists, rather than the line count. `role`
 * is an accessibility decision, not styling: the `Alert` primitive defaults to
 * `role="alert"`, and both caveats deliberately override it because they are
 * inserted after paint, once the stored flag resolves, and an assertive live
 * region interrupts a screen reader mid-announcement to say something
 * advisory. Held in two places, that reasoning was also *written out* in two
 * places, and the next person to revisit it would have changed one.
 *
 * A caveat therefore supplies only what differs — its own two strings — and
 * decides for itself whether it has anything to say at all.
 */
export function CaveatAlert({ title, body }: { title: ReactNode; body: ReactNode }) {
  return (
    <Alert
      role="status"
      className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 line-clamp-none">
        {title}
      </AlertTitle>
      <AlertDescription className="block text-amber-700 dark:text-amber-300">
        {body}
      </AlertDescription>
    </Alert>
  );
}
