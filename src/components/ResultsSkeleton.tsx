import { AccountListSkeleton, FilterChipsSkeleton } from './SkeletonLoader';

/** One stat card's box, held at the size the loaded card occupies. */
function StatCardSkeleton() {
  return (
    <div
      data-testid="stat-card-skeleton"
      className="p-5 md:p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col items-start gap-3 md:gap-4"
    >
      {/* p-2.5 around a 24px icon in the loaded card */}
      <div className="h-11 w-11 animate-pulse rounded-xl bg-muted/60" />
      <div className="space-y-1.5">
        <div className="h-5 md:h-7 w-20 animate-pulse rounded bg-muted/60" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}

/**
 * What `/results` shows before it knows whether there is anything to show.
 *
 * `/results` is prerendered (`dist/results.html` plus one per locale), and that document is
 * on screen for the entire JS load window. Until GH#44 the no-data branch emitted the Hero,
 * so the prerendered document *was* the marketing landing page and a returning visitor spent
 * that window reading an advertisement for the product they were already using.
 *
 * Two properties are load-bearing, and both are asserted in `ResultsSkeleton.test.tsx`:
 *
 * - **No text.** The document is built once per language; a translated string here would
 *   make ten documents that differ and would put i18n on the path of the one render that
 *   cannot wait for it.
 * - **The same boxes as `AccountListSection`.** Title, sticky search row, four stat cards,
 *   filters, list. The skeleton exists to hold the layout still across the swap, so its
 *   sizes track that component's; changing one without the other reintroduces the shift.
 *   jsdom computes no layout, so no test can prove the heights match — that is a device
 *   check, not a unit test.
 */
export function ResultsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="results-skeleton"
      className="max-w-7xl mx-auto py-6 md:py-16 space-y-6 md:space-y-12 mb-12 px-4"
    >
      {/* Heading: title, then the file-info line under it */}
      <div className="space-y-2">
        <div className="h-9 md:h-12 w-64 md:w-96 animate-pulse rounded bg-muted/60" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
      </div>

      {/* Sticky row: search field and the sort toggle beside it */}
      <div className="flex items-center gap-2">
        <div className="h-[54px] flex-grow md:w-80 animate-pulse rounded-2xl border border-border bg-muted/60" />
        <div className="h-[50px] w-[50px] shrink-0 animate-pulse rounded-2xl border border-border bg-muted/60" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 md:gap-12">
        <FilterChipsSkeleton />
        <AccountListSkeleton />
      </div>
    </div>
  );
}
