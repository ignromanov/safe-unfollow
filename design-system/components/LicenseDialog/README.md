Where a paid person unlocks a browser, from `src/components/export/LicenseDialog.tsx`. Two entries: the redirect after checkout (the key arrives in the URL and activates at once) and manual entry ("Already purchased? Enter your key") on a second device. It is the one screen where a person has already paid, so every failure ends in a visible message and a next step, never a silent failure.

States:

- **Enter a key**: title "Unlock your export", "Enter the license key from your purchase email to unlock the export in this browser.", a monospace 48px input (placeholder `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`), primary "Unlock this browser".
- **Activating** (from the redirect): the description becomes the stable "Instant unlock after checkout"; the button is disabled with a spinner, "Unlocking…".
- **Wrong format** and **Key not found**: a `destructive` 14px line ("That does not look like a license key. Check the key in your purchase email." / "We could not find this license key. Check the key in your purchase email."); with a typed key the input turns invalid and the button stays "Unlock this browser"; after a redirect the only action is the outline "Enter the key by hand".
- **Network or unknown failure**: "Activation failed. Check your connection and try again." and a primary "Try again".
- **Unlocked**: green check, "Export unlocked", "This browser can now export your list as often as you want: as a report, a CSV or a JSON file.", "One-time purchase · no subscription", "Your key" with the key masked to its last four characters in monospace, and "Saved in this browser. Your key works on up to 3 browsers — the link in your purchase email unlocks the next one." Primary "Choose a format" (or "Done").
- **All 3 browsers are in use** (terminal): muted alert icon, "Your key is already active on three browsers. Your purchase is fine — this one cannot be the fourth.", then "Email <address> with your key. If we cannot free a browser, we refund your purchase in full." and an "Email support" button. A disabled or refunded key shows RevokedLicenseNotice instead.

The key is never shown in full after activation and is never sent anywhere except the licence check.

Known source defect, kept: `destructive` error text is about 3.7:1 on the dark `background`, under 4.5:1.

Static rendition: no behaviour. The placeholder is clipped on a 390px screen exactly as the source clips it.
