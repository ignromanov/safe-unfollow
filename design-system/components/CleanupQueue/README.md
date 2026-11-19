**Concept for v1.8, not shipped.** Drawn from `plans/2026-11-14-v1.8-pro-revenue/` in the conclave repo; nothing here exists in `src/` yet, and paywall, price and GA4 changes stay frozen until 2026-11-22. Numbers on screen (143 hints, 37 of 218) are illustrative.

The one-by-one cleanup mode (`04-marks-and-cleanup-queue.md`). A card shows the counter ("37 of 218", "12 more today"), a progress bar, the account with "Followed since March 2021 · not following back", a primary **Open in Instagram** link and three marks: **Unfollowed**, **Keep**, **Later**.

- The link is a real `<a href="https://instagram.com/<name>">`, a tap, not a redirect and not `instagram://`, so iOS and Android open the app.
- When the person comes back to the tab, a bottom sheet asks "What did you do with @name?" with the same three answers. "Unfollowed" removes the account and lowers the counter, "Keep" hides it for good, "Later" moves it to the end.
- Tomorrow the queue continues where it stopped ("Done for today").
- Two notices: in embedded browsers the link stays inside, so ask to open the page in Safari; on iPhone, saved data can disappear after about 4 weeks, which would lose the Keep list.

Never imply the account is unfollowed: we only know what the person tapped, and SafeUnfollow does not act on Instagram or contact it. Marks live in their own small IndexedDB database in the browser, never in Zustand and never in analytics. Targets are at least 44px and reachable by thumb at 375px.

Static rendition: no behaviour.
