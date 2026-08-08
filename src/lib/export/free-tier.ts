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
 * The first rows of whatever the reader is currently looking at.
 *
 * `indices === null` is the export layer's "all accounts", so the cap becomes a
 * leading range. With a filter active the cap applies to the filtered view, not
 * to the dataset — the sample should show the rows the reader asked for.
 *
 * The rows land in the file in ascending index order regardless of the on-screen
 * sort, because `iterateAccountsForExport` normalises order. That matches the
 * paid export rather than the screen, which is the consistency that matters: the
 * sample must look like a smaller version of what is being sold.
 */
export function capIndicesForFreeExport(indices: number[] | null, totalCount: number): number[] {
  if (indices !== null) return indices.slice(0, FREE_EXPORT_ROWS);

  const length = Math.min(FREE_EXPORT_ROWS, Math.max(totalCount, 0));
  return Array.from({ length }, (_, index) => index);
}

/**
 * Whether the free file leaves anything unsold.
 *
 * False means the reader's current view fits inside the allowance, so the file
 * they just received is complete. Nothing may be pitched on top of that: the
 * upsell would be claiming there is more, about a file they can open and count.
 */
export function isFreeExportCapped(indices: number[] | null, totalCount: number): boolean {
  const rowCount = indices === null ? totalCount : indices.length;
  return rowCount > FREE_EXPORT_ROWS;
}
