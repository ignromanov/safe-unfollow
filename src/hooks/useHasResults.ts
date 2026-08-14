import { useSyncExternalStore } from 'react';

import { useAppStore } from '@/lib/store';

function getSnapshot(): boolean {
  const { uploadStatus, fileMetadata } = useAppStore.getState();
  return uploadStatus === 'success' && fileMetadata !== null;
}

/**
 * Whether an analysed file is loaded.
 *
 * `getServerSnapshot` is read only while hydrating, so it forces the no-data branch
 * even for a returning visitor whose persisted store already says otherwise — this
 * project's zustand `persist` is synchronous (`getItem` is plain localStorage plus
 * JSON.parse), so `getState()` already carries data at module evaluation.
 *
 * Measured caveat, so nobody re-derives it: reading the same fields through
 * `useAppStore(selector)` would ALSO hydrate at the no-data branch. zustand's persist
 * pins `api.getInitialState()` to the pre-hydration config result
 * (`zustand/esm/middleware.mjs:376`) and its React binding passes that as
 * `getServerSnapshot` (`zustand/esm/react.mjs:9`) — verified on zustand 5.0.11:
 * after a `setState`, `getState().uploadStatus` is 'success' while
 * `getInitialState().uploadStatus` is still 'idle'. So this hook is NOT preventing a
 * hydration mismatch that would otherwise happen; it states the contract explicitly
 * instead of depending on that undocumented middleware behaviour, and it replaces a
 * useEffect-set `mounted` gate that cost an extra committed frame.
 *
 * Deliberately not Suspense/lazy — see the note at HomePage.tsx:12-18 for why that
 * produces React #418/#425 in this codebase.
 */
export function useHasResults(): boolean {
  return useSyncExternalStore(useAppStore.subscribe, getSnapshot, () => false);
}
