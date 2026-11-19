The format chooser and everything that follows a download, from `src/components/export/ExportDialog.tsx`. Opens only for an unlocked person.

States, one view at a time:

- **Choose a format**: title "Export accounts", "<n> accounts will be exported". Three full-width buttons, each a bold label over a 12px hint: **Download report** (primary, "Opens in a browser on your phone or computer. Print it to save a PDF."), **Download CSV** ("Opens in Excel, Google Sheets and Numbers"), **Download JSON** ("For scripts and your own tools"). Below them: "A blank date means we found no date for that account in your file."
- **Report ceiling**: above 50,000 accounts an extra line sits under the report button: "The report lists up to 50,000 accounts. The CSV has all <n>." The ceiling is `HTML_REPORT_MAX_ROWS` in `src/lib/export/report-sections.ts`.
- **Building**: "Building your file", "Your export is built here, in this browser.", an 8px progress bar in `primary`, "<done> of <total> accounts" in tabular figures. The format buttons stay but are disabled, the chosen one shows a spinner. A hidden live region announces progress only in 10% steps.
- **Saved**: a green check, "Saved to your device", "<filename> — all <n> accounts.", then "Check your Downloads folder. On iPhone, look in Files › Downloads." Actions: "Export again" (primary), "Done" (outline).
- **Failed**: "Export failed. Please try again." in `destructive` with an alert icon, above the same buttons.
- **Revoked key**: see RevokedLicenseNotice.

The file is built in the browser and never uploaded; say so in the building state, not in marketing words. Files are named `safeunfollow-<date>.<ext>`.

Known source defects, kept: the `destructive` failure text is about 3.7:1 on the dark `background` (5.3:1 on light), under the 4.5:1 text minimum; the check icon is `emerald-500`, about 2.5:1 on light, decorative and always paired with text.

Static rendition: no behaviour; progress is frozen at 41%.
