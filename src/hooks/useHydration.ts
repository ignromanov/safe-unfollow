import { useAppStore } from '@/lib/store';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useEffect, useState } from 'react';

/**
 * Custom hook to handle Zustand store hydration.
 * Ensures the store has finished loading from localStorage before rendering.
 *
 * After hydration, verifies that any persisted fileHash still exists in IndexedDB.
 * If the user cleared browser data (or IDB was wiped), Zustand might reference
 * a fileHash that no longer exists — this hook detects that and resets the store.
 */
export function useHydration() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const _hasHydrated = useAppStore(s => s._hasHydrated);

  useEffect(() => {
    if (_hasHydrated) {
      setHasHydrated(true);
    } else {
      try {
        const unsubscribe = useAppStore.subscribe(state => {
          if (state._hasHydrated) {
            setHasHydrated(true);
            unsubscribe();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.warn('[useHydration] Store subscription failed, assuming hydrated:', error);
        setHasHydrated(true);
      }
    }
  }, [_hasHydrated]);

  // After hydration, verify IDB consistency (client-only)
  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    // Guard: ensure getState is available (may not exist in test mocks)
    if (typeof useAppStore.getState !== 'function') return;

    verifyIDBConsistency();
  }, [hasHydrated]);

  return hasHydrated;
}

/**
 * Verify that Zustand's fileHash actually exists in IndexedDB.
 * If IDB was cleared but Zustand still has stale data, reset the store.
 */
async function verifyIDBConsistency(): Promise<void> {
  const { fileMetadata, clearData } = useAppStore.getState();

  if (!fileMetadata?.fileHash) return;

  try {
    const idbMeta = await indexedDBService.getFileMetadata(fileMetadata.fileHash);
    if (!idbMeta) {
      console.warn(
        '[useHydration] fileHash not found in IndexedDB, resetting store:',
        fileMetadata.fileHash
      );
      clearData();
    }
  } catch (error) {
    // IDB access failed (e.g. private browsing, corrupted DB)
    // Reset to prevent broken state
    console.warn('[useHydration] IDB verification failed, resetting store:', error);
    clearData();
  }
}
