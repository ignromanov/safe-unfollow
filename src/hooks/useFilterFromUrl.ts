import { useEffect, useRef } from 'react';
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
 * Exported because Task 7 needs the same answer without reading the store: the
 * arrival snapshot lives in a child component, React runs child effects before
 * parent effects, and the store does not hold the URL's selection yet at that
 * moment. Both callers go through this function, so `BADGES` stays the only
 * copy of the badge list.
 */
export function readArrivalFilter(search: string): BadgeKey | null {
  const requested = new URLSearchParams(search).get('filter');
  return requested && BADGES.has(requested) ? (requested as BadgeKey) : null;
}

/**
 * Applies `?filter=<badge>` on arrival, once.
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
 */
export function useFilterFromUrl(): void {
  const [searchParams] = useSearchParams();
  const setFilters = useAppStore(s => s.setFilters);
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;

    const requested = readArrivalFilter(searchParams.toString());
    if (!requested) return;

    setFilters(new Set<BadgeKey>([requested]));
  }, [searchParams, setFilters]);
}
