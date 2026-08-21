# github.md

repo: ignromanov/safe-unfollow
branch: main

secondary-repo: ignromanov/safe-unfollow-ai
secondary-branch: master
secondary-path: .claude

## Last sync

date: 2026-08-20T20:50:00Z
commit: (not recorded — see note)

### Updated in this project
- Checked out 38 commits / 300 files on `main` since the last recorded commit (302922e8bafb). Most of the diff is tests, backend parsing (`zip-archive.ts`, `relationship-skew.ts`) and locale copy — not design-relevant.
- **Note on scope**: this project's component library, tokens, catalog and `DESIGN-GUIDE.md` are synced source owned by the `/design-sync` Claude Code skill (per this project's own read-only rule) — I cannot hand-regenerate `_ds_bundle.js`/`styles.css`/`components/*` here. Comparing `_ds_sync.json` (already at `safe-unfollow@1.6.0`, includes `CaveatAlert`, `TruncatedFileCaveat`, `PaywallModal`'s proportion-bar redesign, `LicenseDialog`, `ResultsExportControls`, `TouchUploadZone`/`DesktopDropZone`/`LoadingTips`/`UploadAffiliateBlock`) against current `main`, three things are genuinely newer than the synced bundle and need a real `/design-sync` run:
  1. **Font-loading fix** (`src/styles.css`): `@font-face` family names corrected to `'Inter Variable'` / `'Plus Jakarta Sans Variable'` (the old names never matched the shipped variable-font packages, so every page silently rendered in the system font fallback since inception) and heading `line-height` raised `1.15 → 1.25` to clear descenders/ascenders in the now-correctly-loaded faces. `foundations/type-display.card.html` still specs the old family names and 1.15 — will need re-sync.
  2. **New wizard step components**: `src/components/wizard/{GuideEntry,RecipeCard,StepAccordion}.tsx` are not yet in `_ds_sync.json` — this looks like the shipped version of this project's own `templates/conversion-audit` mockup 1B proposal (single-action guide entry + recipe card, replacing the 9-card wall). Flagged in `templates/conversion-audit/ConversionAudit.dc.html`.
  3. `BuyMeCoffeeWidget` component was removed from the app (`Footer.tsx` no longer imports it; its own test file was deleted) but the design system still carries `components/general/BuyMeCoffeeWidget/` — safe to keep as historical reference, but `/design-sync` should confirm whether to drop it.
- `public/.well-known/apple-developer-merchantid-domain-association` added (Apple Pay domain verification) — infra, not design.

## Sync history

- 2026-08-20T20:50:00Z — this sync: identified 3 design-relevant gaps (font-loading fix, new wizard components, BuyMeCoffeeWidget removal) between `main` and the synced `_ds_sync.json`; recommended a fresh `/design-sync` run. No synced source files changed by me (read-only per project rule). `templates/conversion-audit/ConversionAudit.dc.html` annotated.
- 2026-08-09T20:20:36Z — initial import: 18 foundation specimen cards, component catalog, click-through UI kit, DESIGN-GUIDE.md, brand assets.

## Screen map

| Project file | Built from (safe-unfollow) |
|---|---|
| `ui_kits/app/Chrome.jsx` | `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/Logo.tsx` |
| `ui_kits/app/Screens.jsx` | `src/components/Hero.tsx`, `src/components/HowToSection.tsx`, `src/components/UploadZone.tsx`, `src/locales/en/hero.json`, `src/locales/en/howto.json` |
| `ui_kits/app/Results.jsx` | `src/components/AccountListSection.tsx`, `src/components/StatCard.tsx`, `src/components/FilterChips.tsx`, `src/components/AccountItem.tsx`, `src/components/FollowRequestsCaveat.tsx`, `src/components/InlineDonationCard.tsx`, `src/constants/badge-styles.ts`, `src/locales/en/results.json` |
| `ui_kits/app/kit.jsx` | `src/constants/badge-styles.ts`, `src/locales/en/common.json` |
| `foundations/*.card.html` | `src/styles.css`, `tailwind.config.js`, `src/constants/badge-styles.ts` |
| `assets/*` | `public/logo.svg`, `public/favicon.svg`, `public/og-image.png`, `assets/*.png` |
| `DESIGN-GUIDE.md` | `src/styles.css`, `src/components/*`, `src/locales/en/*`, and `safe-unfollow-ai:.claude/{product,constitution,WIZARD_STYLE_DIFF,mobile-optimization-summary}.md`, `.claude/skills/conclave-{lumen-cro,privacy-trust}/SKILL.md` |
