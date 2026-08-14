import { useSyncExternalStore } from 'react';

// Nothing to subscribe to: the answer changes exactly once, when React hydrates.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Whether React has hydrated.
 *
 * For branches that are genuinely client-only — a theme icon, a Radix-generated id, a
 * widget that touches `window` — and therefore must render their neutral shape into the
 * prerendered HTML.
 *
 * This is deduplication, not performance: it replaces a `useState(false)` +
 * `useEffect(() => setMounted(true), [])` pair that did the same job, one copy per
 * component. It saves no frames.
 *
 * NOT for "my data has loaded". A flag raised inside an effect that also reads
 * localStorage means something else, and swapping it for this hook produces a render
 * where hydration is done but the data is still absent — see FormatQuiz, which keeps its
 * own flag for that reason.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
