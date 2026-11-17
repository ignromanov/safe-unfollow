Privacy-first Instagram unfollow tracker. The export is analysed in the browser; the interface is clean, light and fast, with one indigo-to-pink gradient as its only loud gesture.

## Content fundamentals

- Always write the domain in full: **SafeUnfollow.app**. Never bare "SafeUnfollow": a Chrome extension of that name automates unfollowing, and `safeunfollow.com` is a lookalike.
- Address the reader as "you", plain and direct, sentence case. No emoji as decoration.
- Say what is true: "Free analysis", "No login", "No password", "Runs in your browser", "Your export never leaves your device", "JSON & HTML ZIP".
- Never write: "Free forever", "Works offline", "JSON only", "Zero ban risk", "No servers", "No tracking", "No ads". Ads, analytics and payments exist and are disclosed; only the export stays local.
- Demo screens show only synthetic usernames (`@mattcoffee_co`, `@emilyski.ig`, `@build.jason23`, `@julia_fitness`).
- Ten languages including Arabic (RTL). Leave room for 30% longer strings.

## Visual foundations

- **Surfaces.** Page is `background`, panels are `card` with a 1px `border` and `radius-lg`. Hover and selected rows use `accent`. Quiet fills use `muted`. Dark theme is the same tokens under `data-theme="dark"`.
- **Brand colour.** Use `primary` for fills (buttons, the active stat card) with `primary-foreground` text. Use `primary-strong` for any brand-coloured text or icon. Never put `primary` text on `background`.
- **Gradient.** `linear-gradient(135deg, brand-start, brand-mid, brand-end)` for the logo icon, one gradient headline word per page (`display` face, clipped to text) and hero accents. Nothing else gets a gradient; no gradient buttons.
- **Status.** Not following back: `badge-negative-fg` on `badge-negative-bg`, always with the word. Following: `badge-info-*`. Destructive actions use `destructive` with `destructive-foreground`. In account rows each of the eleven relationship badges is a chip coloured by its own `rel-<badge>-fg`, `-bg` and `-border` tokens, always carrying the badge name. Never signal status by colour alone.
- **Type.** Headlines in `display-hero`, `display-section`, `display-card` (Plus Jakarta Sans 800/700, tracking -0.04em, line-height 1.25; tracking 0 in RTL). Everything else in `body`, `body-medium`, `caption` (Inter). Wordmark: "SafeUnfollow" in `foreground`, ".app" in `primary-strong`.
- **Shape.** Cards `radius-lg`, buttons and inputs `radius-md`, chips `radius-sm`, dialogs `radius-xl`. The logo squircle is `radius-logo` on a 512 box.
- **Space.** Multiples of 4px. Cards pad `space-4` on mobile, `space-6` on desktop. Mobile first: the upload and results flows are designed at 390px wide.
- **Shadows and motion.** Shadows are light and only on hover or overlays. Respect `prefers-reduced-motion`; on touch devices drop hover scale, lift and shadow.
- **Focus.** A 2px `ring` outline at 50% opacity on every interactive element; keep a visible focus state on dark.

## Iconography

Lucide, stroke icons, via shadcn/ui (new-york style, Radix primitives). Icons inherit text colour. The product mark is the shield-check in `assets/Logos`; never redraw it.

## Logos

`logo-v3.svg` (squircle, headers, decks), `logo-v3-avatar.svg` (full bleed, for circular crops), `logo-text.svg` (horizontal lockup, light backgrounds), `logo-text-dark.svg` (dark backgrounds). On video end-cards use the lockup, not the icon alone.

## Not synced

Built from `ignromanov/safe-unfollow` at `refactor/retire-donation-surfaces@a0076316`. Skipped: `calc()` radii (written out as px), Tailwind palette overrides, gradient scrollbar utilities, Cyrillic, Greek and Vietnamese font subsets (latin only), and the React library: Button, Badge, Input, Alert, StatCard, Logo, SearchBar, AccountItem, FilterChips, Tabs, Accordion, Dialog and UploadZone are static recreations from source (no bundle, no behaviour). Not included: Hero, Header, Footer, rescue-plan cards, dropdown menu, sheet, alert dialog, ads and export surfaces.
