**Concept for v1.8, not shipped.** Drawn from `plans/2026-11-14-v1.8-pro-revenue/` in the conclave repo; nothing here exists in `src/` yet, and paywall, price and GA4 changes stay frozen until 2026-11-22. Numbers on screen (143 hints, 37 of 218) are illustrative.

The block above the list on `/results` (`05-suggestions-and-smart-lists.md`): **who to unfollow first** and **ready lists**, computed from the follow dates the app already stores.

- **Free**: "Who to unfollow first · 5 of 143". The count is always free. Names: the first 5 of the ranking and the first 3 of each list are open, then a skeleton strip with "138 more — in Pro". Ready lists show their count and a lock: "Followed 3+ years, not following back 64", "Followed this month, not followed back yet 12", "Requests pending over a year 31", "You unfollowed them, they still follow you 9".
- **Pro**: everything open, rows end in a chevron; sorting the list by follow date is also Pro.
- **Short list** (under 30, `PAYWALL_MIN_ROWS`): shown whole, no lock.
- **Truncated export or unread dates**: the date-based lists are hidden and the block says why, reusing the report's wording ("ask Instagram for your data again with the date range set to “All time”"). Never show a wrong count.

Copy rules: say "not following back", never "ignores you"; do not promise "ghost followers", the export has no incoming activity. List counts reach analytics only after task 09.

Static rendition: no behaviour; usernames are synthetic.
