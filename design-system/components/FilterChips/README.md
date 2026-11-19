Grouped filter tiles on `/results`, from `src/components/FilterChips.tsx`. Each tile toggles one of eleven badge filters and shows what it would yield against the current selection.

The consumer provides `selectedFilters`, `onFiltersChange`, `filterCounts` and `candidateCounts` (null until measured; null disables nothing, zero disables the tile), and optional truncation flags that mark a count as overstated. Tiles sit in a two-column grid with 10px gaps under a group heading (12px, weight 900, uppercase, 0.1em tracking). Tile: 85px minimum height, 16px padding, 16px corners, a lucide 18px icon and a count pill (`radius-lg`). Active: `primary` fill with `primary-foreground`. Unavailable: 50% opacity and `aria-disabled`. Always set `aria-pressed`.

Resting label (zinc-600 / zinc-400) and heading (zinc-500) come straight from the source and are Tailwind greys, not tokens; the heading is about 4.8:1 on white, close to the floor.

Static rendition: no behaviour; a trimmed set of four tiles of the eleven.
