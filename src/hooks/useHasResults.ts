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
 * even for a returning visitor whose persisted store already says otherwise. This
 * project's zustand `persist` is synchronous — `getItem` is plain localStorage plus
 * JSON.parse, so nothing defers it past module evaluation — which means the client's
 * first render intent would otherwise disagree with the prerendered HTML. That is a
 * structural SSR/CSR mismatch, not a race, and it is why gating on a useEffect-set
 * `mounted` flag is the wrong shape: the flag costs an extra committed frame showing
 * the wrong UI, which is exactly the symptom being fixed.
 *
 * Deliberately not Suspense/lazy — see the note at HomePage.tsx:12-18 for why that
 * produces React #418/#425 in this codebase.
 */
export function useHasResults(): boolean {
  return useSyncExternalStore(useAppStore.subscribe, getSnapshot, () => false);
}
