**Concept for v1.8, not shipped.** Drawn from `plans/2026-11-14-v1.8-pro-revenue/` in the conclave repo; nothing here exists in `src/` yet, and paywall, price and GA4 changes stay frozen until 2026-11-22. Numbers on screen (143 hints, 37 of 218) are illustrative.

The one Pro screen, planned in `06-paywall-sheet.md`. It replaces the offer part of today's PaywallModal and has four ways in; **only the title changes**:

| Call site                    | Title                            |
| ---------------------------- | -------------------------------- |
| Locked hints and ready lists | "All 143 hints" (the real count) |
| End of the daily quota       | "Finish your cleanup in a week"  |
| The Export button            | "Full export"                    |
| The "Remove ads" link        | "No ads"                         |

Layout, top to bottom: title (20px bold), four ticked benefits, PassPicker (1 year preselected), "Pay <price>" (48px, 16px bold, soft `primary` shadow), the terms line, the refund line and "Already purchased? Enter your key". Built on ExportSheet, so it is a bottom sheet below 640px and must fit 375px wide without scrolling.

Rules from the plan, kept: the close button is always visible (unlike today's paywall); the quota variant always offers a free way out, "Come back tomorrow"; after it is closed it does not reopen on its own that session; no timers, "N left" or struck-through prices; nothing derived from the person's export (account count, list length) goes to the payment provider.

Copy to settle before build. (1) The plan's own sketch says "Без рекламы" but task 08 says to promise only "Ad scripts and Google Analytics are not loaded", never "no trackers" (Umami stays). The benefit line uses the precise wording; the title "No ads" is the plan's and `monetization-claims.test.ts` may reject it, so ask velum-cdpo. (2) The terms line follows the planned ToS: one payment for the stated term, no auto-renewal, 14-day refund for the new passes. Sales copy needs a native reader in id, pt, ar and de.

Static rendition: no behaviour.
