/**
 * The free slice of the export, and the rules for when it is a slice at all.
 *
 * Kept apart from `data.ts` on purpose: that module reaches into IndexedDB, and
 * these two facts are needed in the click handler *before* deciding whether to
 * pull the export code in at all. Importing them from there would drag the
 * whole storage layer into the main bundle for the sake of one integer.
 */

/**
 * Rows handed over before the paywall.
 *
 * An absolute count rather than a share: a percentage gives an influencer
 * thousands of rows for nothing and a casual user four, which is backwards on
 * both ends. Ten is the measured category norm (PhantomBuster, Hunter.io,
 * ZoomInfo all cap on counts) and it is far short of finishing the job for any
 * plausible unfollower list — which is where the cannibalisation research puts
 * the danger line for free tiers.
 */
export const FREE_EXPORT_ROWS = 10;

/**
 * How many times the free slice the view must be before there is anything worth
 * selling.
 *
 * The old rule was "anything over the slice", which made a view of twelve rows
 * a paid offer: ten free, two for $7, about a file the reader can open and
 * count. That is the same lie `isFreeExportCapped` was written to prevent at
 * ten, one step to the right — the honesty of the pitch does not switch on at
 * the allowance, it fades in over it.
 *
 * Three is a judgement, not a measurement. The reasoning is that a file's worth
 * tracks how impossible the list is to copy out by hand: at 1,284 rows the file
 * is the only way, at thirty it is a convenience the reader can refuse by
 * scrolling. Nothing is given away that would have sold.
 *
 * The distribution of selection sizes is not instrumented: `export_trigger_viewable`
 * carries `is_unlocked` but no row count, `free_export_download` carries only
 * the capped flag, and account-list size is the wrong proxy because the export
 * follows the active filter. Revisit once one of those events carries buckets.
 */
export const PAYWALL_MIN_RATIO = 3;

/** Views at or below this size are handed over whole, with no pitch attached. */
export const PAYWALL_MIN_ROWS = FREE_EXPORT_ROWS * PAYWALL_MIN_RATIO;

/**
 * Rows in what the reader is currently looking at.
 *
 * `indices === null` is the export layer's "all accounts"; anything else is the
 * filtered view, and the filtered view is what the reader asked for.
 */
function viewSize(indices: number[] | null, totalCount: number): number {
  return indices === null ? Math.max(totalCount, 0) : indices.length;
}

/**
 * Whether the free file leaves anything unsold.
 *
 * False means the reader's current view is small enough to hand over whole, so
 * the file they just received is complete. Nothing may be pitched on top of
 * that: the upsell would be claiming there is more, about a file they can open
 * and count.
 */
export function isFreeExportCapped(indices: number[] | null, totalCount: number): boolean {
  return viewSize(indices, totalCount) > PAYWALL_MIN_ROWS;
}

/**
 * The rows the free export actually writes.
 *
 * Derived from `isFreeExportCapped` rather than deciding for itself, because
 * the two answers have to agree by construction: a view that gets no paywall
 * must also get no `-sample` suffix and no truncation, and a caller holding one
 * of those beliefs while the file holds the other is a silently wrong file.
 *
 * The rows land in ascending index order regardless of the on-screen sort,
 * because `iterateAccountsForExport` normalises order. That matches the paid
 * export rather than the screen, which is the consistency that matters: the
 * sample must look like a smaller version of what is being sold.
 */
export function capIndicesForFreeExport(indices: number[] | null, totalCount: number): number[] {
  const size = viewSize(indices, totalCount);
  const length = isFreeExportCapped(indices, totalCount) ? FREE_EXPORT_ROWS : size;

  if (indices !== null) return indices.slice(0, length);

  return Array.from({ length }, (_, index) => index);
}
