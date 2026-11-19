**Concept for v1.8, not shipped.** Drawn from `plans/2026-11-14-v1.8-pro-revenue/` in the conclave repo; nothing here exists in `src/` yet, and paywall, price and GA4 changes stay frozen until 2026-11-22. Numbers on screen (143 hints, 37 of 218) are illustrative.

Connecting Pro and living with it (`03-license-client-validate.md`, `08-ad-free-pro.md`, `07`).

- **After payment**: "Pro is on", "Active until <date>", the masked key (last four), "Reload" (one reload is needed if ad scripts were already loaded) and "Save your key" through the system share sheet. The ad-free line is the exact promise: "Ad scripts and Google Analytics are not loaded".
- **Entering a key** on a second device: a 48px monospace field with **Paste** (Clipboard API) and "Cannot find your key?", which opens the Dodo customer portal.
- **Your Pro** in settings: pass and end date, masked key, "Find my key", "Remove from this browser". Earlier purchases show "No end date".
- **Pass ended**: "Your 30 days ended"; ads return at the next check and marks and the Keep list stay. Actions: Renew, Enter another key.
- **Browser limit**: 3 browsers for a 30-day pass, 30 for a year pass; the message is "Your purchase is fine" with the portal link and support, never a dead end. A Home Screen web app on iOS has its own storage and uses one more copy: mention it where the limit is explained.

The key is never shown in full after activation, never put in an address, and no email, name or phone from the licence service is stored.

Static rendition: no behaviour.
