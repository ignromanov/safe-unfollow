import { useSyncExternalStore } from 'react';

import { useAppStore } from '@/lib/store';

type StoreState = ReturnType<typeof useAppStore.getState>;

/**
 * Read the app store with an explicit value for the prerendered render.
 *
 * Every page on this site ships as prerendered HTML built with an empty store, so any
 * store-backed branch must render its empty shape while hydrating and only then switch.
 * `serverValue` is that shape, stated at the call site.
 *
 * Reading the same field through `useAppStore(selector)` happens to behave the same way
 * today, but only because zustand's `persist` pins `api.getInitialState()` to the
 * pre-hydration config result (`zustand/esm/middleware.mjs:376`) and its React binding
 * passes that as `getServerSnapshot` (`zustand/esm/react.mjs:9`) — verified on zustand
 * 5.0.11: after a `setState`, `getState().uploadStatus` is 'success' while
 * `getInitialState().uploadStatus` is still 'idle'. That is undocumented middleware
 * behaviour, and it would stop holding under `skipHydration` or an async storage. This
 * helper does not depend on it.
 *
 * CONSTRAINT: `selector` must return something `Object.is`-stable when the store has not
 * changed — a primitive, or a reference the store itself holds. Returning a fresh object
 * or array makes `useSyncExternalStore` re-render forever.
 */
export function useStoreSSR<T>(selector: (state: StoreState) => T, serverValue: T): T {
  return useSyncExternalStore(
    useAppStore.subscribe,
    () => selector(useAppStore.getState()),
    () => serverValue
  );
}
