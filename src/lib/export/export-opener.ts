/**
 * A handoff from the activation dialog to the format dialog, across a tree that
 * has no path between them.
 *
 * The two entry points to activation do not share a parent. Manual entry is
 * opened by `ResultsExportControls`, which owns the format dialog's state and
 * can therefore hand over directly — that path has always ended in "Choose a
 * format". The post-checkout redirect is captured in `Layout`, because the
 * `?license_key=` param must be stripped before any pageview can read it,
 * whatever page it lands on; `Layout` sits above the router outlet and cannot
 * reach the results view's state. So the buyer who had just paid was the one
 * reader whose activation ended in a closed sheet.
 *
 * A store rather than a context: the two components are on opposite sides of
 * the outlet, and threading a provider through every page to serve one handoff
 * on one page would put the plumbing everywhere the handoff is not. This
 * mirrors `unlock.ts`, which shares its state the same way and for the same
 * reason.
 *
 * `hasExportOpener()` is what keeps the label honest. The redirect returns to
 * the path checkout started from, which is always the results view — but a
 * reader whose IndexedDB data is gone by then is bounced off it, and a button
 * saying "Choose a format" with no list to choose a format for is the dead
 * click this whole flow exists to remove.
 */

const openers = new Set<() => void>();
const watchers = new Set<() => void>();

function notifyWatchers(): void {
  for (const watcher of watchers) {
    watcher();
  }
}

/**
 * Registers the one action that can open the format dialog, and returns its
 * unregister. Called by whichever export control is mounted.
 */
export function registerExportOpener(open: () => void): () => void {
  openers.add(open);
  notifyWatchers();

  return () => {
    openers.delete(open);
    notifyWatchers();
  };
}

/** Subscribes to `hasExportOpener()` changing — for `useSyncExternalStore`. */
export function subscribeExportOpener(watcher: () => void): () => void {
  watchers.add(watcher);

  return () => {
    watchers.delete(watcher);
  };
}

/** Whether a mounted control can receive the handoff. */
export function hasExportOpener(): boolean {
  return openers.size > 0;
}

/** Server snapshot: nothing is mounted during prerender. */
export function getServerExportOpenerSnapshot(): boolean {
  return false;
}

/** Asks the mounted control to open the format dialog. A no-op if none is. */
export function openExportDialog(): void {
  for (const open of openers) {
    open();
  }
}
