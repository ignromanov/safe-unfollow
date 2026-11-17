Inline notice with an optional leading icon, from `src/components/ui/alert.tsx` (`Alert`, `AlertTitle`, `AlertDescription`).

Use `default` for neutral information and caveats, `destructive` for errors that block the flow. The consumer provides a title, a description, and optionally a 16px lucide icon as the first child. Surface is `card` with a 1px `border` and `radius-lg`, padding 12px by 16px, text 14px. The description is `muted-foreground`; in `destructive` both title and description use `destructive` (the source does not measure that pair on `card`, so check it before shipping new copy).

Copy must stay within the privacy claim: say the export stays in the browser, never "no tracking".

Static rendition: no behaviour.
