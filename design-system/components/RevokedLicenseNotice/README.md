The message for a key that no longer works, from `src/components/export/RevokedLicenseNotice.tsx`, plus its action `SupportMailtoLink`. Shown inside ExportDialog when the session's licence check finds the key disabled or refunded (the stored key is cleared first), and inside LicenseDialog as one of its terminal states.

Copy: red alert icon, "This key is no longer active", then "It was disabled or refunded. If that is unexpected, email <address> with the key — that is all we need." `role="alert"`. The footer holds one primary link, "Email support" (`mailto:` with the subject "Pro Export licence"), 48px minimum, `rounded-2xl`.

Tone: no blame and no upsell. Do not put a "Buy again" button here; the next step is a person, not a purchase. The support address is `SUPPORT_EMAIL` in `src/lib/export/support-email.ts`.

Static rendition: the link is inert.
