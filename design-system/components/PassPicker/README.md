**Concept for v1.8, not shipped.** Drawn from `plans/2026-11-14-v1.8-pro-revenue/` in the conclave repo; nothing here exists in `src/` yet, and paywall, price and GA4 changes stay frozen until 2026-11-22. Numbers on screen (143 hints, 37 of 218) are illustrative.

The two-pass choice from `07-pricing-and-terms.md`: **30 days** and **1 year**, a radiogroup of two 56px rows (radio dot, label, price). The selected row has a 2px `primary` border and a faint `primary` tint; the year is preselected. The 30 days cover one cleanup, the year covers watching over time.

Prices come from the country table, never typed in a layout. The previews show the planned grid: US and the rest $7.99 / $19.99, Brazil R$19.90 / R$49.90, India ₹199 / ₹499, Indonesia Rp 29,000 / Rp 79,000, Philippines ₱149 / ₱399. Number formatting follows the locale. The product's own checkout shows the final amount; the picker must always match it (the plan adds a consistency test for five regions and both passes).

Key copies per pass (3 for 30 days, 30 for the year) are explained in ProStatus, not here, so the choice stays two lines each. No "best value" badge, discount arithmetic or struck-through price: the plan forbids them.

Static rendition: no behaviour.
