The offer shown after a free sample was saved, from `src/components/export/PaywallModal.tsx`. This is the one monetized screen of the export flow.

Order, top to bottom:

1. A receipt line: green check, "Saved <filename> — the first 10 of <n> accounts" (12px `muted-foreground`). The person has already received something.
2. The heading is the **number of accounts matched**: Plus Jakarta Sans 800, 44px on phones and 48px from 640px, in `primary-strong`, with "accounts matched by this filter" beneath. It is the real count, never a marketing figure.
3. A 16px bar showing how little of the list the sample was: an emerald segment (at least 12px wide, so it never vanishes), a 2px divider, then `primary` for the rest. Legend: "Yours — first 10" and "The rest of your list". The bar is `aria-hidden`; the legend swatches are outlined so meaning does not rest on colour alone.
4. The gap, in `foreground`: "Your free report has all the counts but lists only the first 10 accounts. The export lists all <n>, as a report, CSV or JSON — one payment, not a subscription."
5. The primary action "Unlock export — <price>": 48px, 16px bold, `rounded-2xl`, with a soft `primary` shadow; then a ghost "Not now" (always visible, never hidden).
6. A hairline and four centred 12px lines: the rival comparison ("Similar trackers charge <range> a month to keep watching your followers. This is <price>, once, for the file itself."), the terms ("One-time <price>. Unlocks on up to 3 browsers."), the refund ("Not what you expected? Email <address> within 30 days and we'll refund it.", the address underlined), and a text button "Already purchased? Enter your key".

Failed checkout: the primary label becomes "Checkout didn't open — try again" and a `destructive` `role="alert"` line says "The payment page did not load. Check your connection and try again."

Rules to keep. No close button, countdowns, "N left", struck-through prices or pre-ticked upsells. Amounts are written by `getDisplayPrice()` and `getRivalMonthlyRange()` per country; the previews show the default column ($7, $5–10). Never claim "no ads", "no tracking" or "works offline" here; the only privacy claim allowed is that the Instagram export stays in the browser.

Known source defect, kept: the `destructive` failure line is about 3.7:1 on the dark `background` (5.3:1 on light), under the 4.5:1 text minimum; the emerald check is about 2.5:1 on light and decorative. The 12px `muted-foreground` lines pass (4.7:1 light, 9.1:1 dark).

Static rendition: no behaviour. The v1.8 plan screens (30-day and annual passes, ad-free) are not in the source yet and are not drawn.
