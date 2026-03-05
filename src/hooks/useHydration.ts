import { useAppStore } from '@/lib/store';

/**
 * Custom hook to handle Zustand store hydration
 * Ensures the store has finished loading from localStorage before rendering
 *
 * The _hasHydrated selector already triggers re-render when it changes,
 * so the previous subscription pattern was unnecessary.
 */
export function useHydration() {
  return useAppStore(s => s._hasHydrated);
}
