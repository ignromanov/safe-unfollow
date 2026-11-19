The pause between pressing "Unlock export" and the payment page appearing, from `src/components/export/CheckoutHandoff.tsx`. It replaces the body of PaywallModal while the checkout opens.

Copy, in order: a 16px semibold line, "Your Instagram export stays in this browser. The payment page never sees it."; a 14px summary "<n> accounts · report + CSV + JSON · <price>, once."; a 12px line "Cards and local methods are shown on the next page." `role="status"` so it is announced once. The footer stays: the primary button reads "Opening checkout…" with a spinner and is disabled and `aria-busy`; "Not now" remains available.

Its job is to say, at the moment of leaving, that the person's list stays here. Keep the first line verbatim: it is a privacy claim, so a change to it goes through the privacy advisor (velum-cdpo), not through design alone.

Static rendition: the spinner turns, nothing else moves.
