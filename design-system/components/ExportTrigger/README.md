The Export button on `/results` and the status lines under it, from `src/components/export/ResultsExportControls.tsx`. It is the only entry to the whole export flow.

The label is "Export" with a 18px download icon: `primary` fill, 44px minimum height, 16px corners, bold. Under it, right-aligned, one line at most:

- **Not unlocked, nothing saved yet**: "Free — a report with the first 10 accounts" (12px `muted-foreground`, 176px wide). It tells the person the click is free before they make it.
- **Unlocked**: no line.
- **Building**: the button is disabled at 50% and `aria-busy`.
- **Failed**: "Export failed. Please try again." in `destructive`, `role="alert"`.
- **Saved in full**: "Saved <filename> — all <n> accounts", `role="status"`. A capped free save has no line here: its receipt moves into the paywall.

Clicking does not always open the same thing. A person who has not unlocked gets a free sample report at once and then the paywall; an unlocked person gets the format chooser. Do not label the button "Buy" or "Upgrade".

Known source defect, kept: the `destructive` failure line is about 3.7:1 on the dark `background`.

Static rendition: no behaviour. The free sample size (10 rows) is `FREE_EXPORT_ROWS` in `src/lib/export/free-tier.ts`.
