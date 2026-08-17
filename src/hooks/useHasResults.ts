import { useStoreSSR } from '@/hooks/useStoreSSR';

/**
 * Whether an analysed file is loaded.
 *
 * The prerendered HTML is always built with an empty store, so `false` is what the
 * markup on disk says and `false` is what the hydrating render must agree with. See
 * `useStoreSSR` for why that is stated here rather than inherited from zustand's persist
 * middleware.
 *
 * Deliberately not Suspense/lazy — see the note at HomePage.tsx:12-18 for why that
 * produces React #418/#425 in this codebase.
 */
export function useHasResults(): boolean {
  return useStoreSSR(s => s.uploadStatus === 'success' && s.fileMetadata !== null, false);
}
