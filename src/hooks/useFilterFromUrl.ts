import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BADGE_ORDER } from '@/core/badges';
import { useAppStore } from '@/lib/store';
import type { BadgeKey } from '@/core/types';

const BADGES = new Set<string>(BADGE_ORDER);

const SLUG = /^[a-z0-9-]{1,40}$/;

/**
 * Which landing page sent this reader, when one did.
 *
 * Attribution is a separate parameter from the filter because a filter can be
 * applied from anywhere, and a landing page is one specific anywhere. Today no
 * affiliate click on this property is attributable to a locale or a surface,
 * because a free-text slot exists and we send nothing into it
 * (`progress.md` P1 row 11). This is that slot, filled at the point of arrival.
 *
 * Validated to a slug rather than passed through: it becomes an analytics
 * dimension, and an unvalidated free-text field becomes an unbounded one.
 */
export function readArrivalSource(search: string): string | null {
  const value = new URLSearchParams(search).get('from');
  return value && SLUG.test(value) ? value : null;
}

/**
 * The badge `?filter=` asks for, or null when it asks for nothing valid.
 *
 * Validation is against `BADGE_ORDER` — existence — and never against what this
 * export contains. Five of the eleven badges come from optional files, so an
 * empty result is routine rather than exceptional, and refusing the parameter at
 * the door would hand the reader an unfiltered list with no account of why the
 * page they clicked did nothing. Applied, the empty state at least names the
 * filter that emptied it.
 *
 * Exported for its own suite. It is deliberately NOT the thing a consumer reads
 * to learn whether a filter was applied — a URL says what was asked for, and
 * only `useFilterFromUrl` knows whether anybody acted on it. That distinction is
 * the whole of the note on the hook below.
 */
export function readArrivalFilter(search: string): BadgeKey | null {
  const requested = new URLSearchParams(search).get('filter');
  return requested && BADGES.has(requested) ? (requested as BadgeKey) : null;
}

/**
 * Applies `?filter=<badge>` on arrival, once — and RETURNS what it applied.
 *
 * The parameter REPLACES the persisted selection. `filters` survives in
 * localStorage, so 52.3% of sessions arrive with something already on; keeping
 * it would intersect yesterday's selection with the intent the reader just
 * clicked, and under grouped AND-across-groups that can produce an empty list
 * from two reasonable choices.
 *
 * Applied once per mount and never again: the parameter stays in the URL so the
 * view is reloadable and shareable, which means a hook that re-read it on every
 * render would make the filter impossible to remove.
 *
 * ## Why it returns a value, and why the value is frozen
 *
 * The arrival snapshot (`arrived_with`) is taken in `AccountListSection`, which
 * `/results` and `/sample` BOTH render — and only `/results` calls this hook.
 * Reading `?filter=` there and calling it applied was true on one page and false
 * on the other: `/sample?filter=pending` would have reported `arrived_with: 1`
 * with nothing applied, and would have emitted a whole summary row for a visit
 * in which the reader did nothing. Only the code that applies a filter can
 * honestly report that it was applied, so the applier hands its answer down and
 * a page that does not apply the parameter has nothing to hand.
 *
 * The answer is computed in a lazy `useState` initialiser rather than in the
 * effect, and that is what keeps the property the snapshot was moved to the URL
 * for in the first place: it is available DURING THE FIRST RENDER, before any
 * effect anywhere has run. A value produced by this hook's effect would be null
 * when the child's effect reads it, because React flushes child effects before
 * parent effects — the exact ordering dependency this avoids. Freezing it also
 * matches what the hook does: it applies the first render's parameter and never
 * re-applies, so reporting any later value would be reporting something that was
 * never applied.
 */
export function useFilterFromUrl(): BadgeKey | null {
  const [searchParams] = useSearchParams();
  const setFilters = useAppStore(s => s.setFilters);
  const applied = useRef(false);

  // The initialiser is pure and runs once per mount; StrictMode's double
  // invocation is therefore free.
  const [arrival] = useState<BadgeKey | null>(() => readArrivalFilter(searchParams.toString()));

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;

    if (!arrival) return;

    setFilters(new Set<BadgeKey>([arrival]));
  }, [arrival, setFilters]);

  return arrival;
}
