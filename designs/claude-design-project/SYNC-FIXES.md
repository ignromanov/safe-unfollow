# Sync fixes — for the next `/design-sync` run

Three validation issues are reported against this design system. All three originate in the
generated artifacts (`_ds_bundle.css`, `_ds_bundle.js`), which this project cannot edit —
changes must be made in `ignromanov/safe-unfollow` and re-synced from Claude Code.

Hand this file to the `/design-sync` agent.

---

## 1. 114 properties registered from component selectors

**Reported as**: *custom properties were declared under component-style selectors
(e.g. `:where(& > :not(:last-child))`) and weren't registered as design-system tokens.*

These are Tailwind v4 runtime internals — `--tw-translate-x`, `--tw-translate-y`, `--tw-shadow`,
`--tw-ring-shadow`, `--tw-ring-offset-shadow`, `--tw-space-y-reverse`, `--tw-inset-shadow` and
similar. They are emitted inside utility rules and reset in the `*, ::before, ::after, ::backdrop`
block at `_ds_bundle.css:5442`. They are **not** theme tokens and should not be moved to `:root`.

**Fix**: exclude the `--tw-*` prefix from token extraction during sync. That also clears the 66
"theme scopes" note (`.translate-y-0`, `.-translate-y-1/2`, …), which are the same utilities
seen from the other side.

## 2. 24 unclassifiable tokens

Real `@theme` values that don't name their kind. They sit together at `_ds_bundle.css:237–247`:

```
--ease-out, --ease-in-out
--animate-spin, --animate-ping, --animate-pulse, --animate-bounce
--aspect-video
--default-transition-duration, --default-transition-timing-function
--blur-md, --default-font-family, --tracking-*  (+ the remainder of the 18 unique)
```

**Fix**, in order of preference:

1. Emit `/* @kind other */` after each easing/animation/aspect token during sync, and
   `/* @kind font */` after `--default-font-family`, `/* @kind spacing */` after `--blur-md`.
2. Or classify by prefix in the sync step: `--ease-*` and `--animate-*` and
   `--default-transition-*` → `other`; `--tracking-*` → `font`.

Neither changes rendering; both are comment-level metadata.

## 3. Stale bundle — the one that actually matters

92 component sources have changed since `_ds_bundle.js` was built, and the bundle carries ~68
inlined npm externals the in-browser bundler cannot reproduce (Radix UI, floating-ui,
TanStack Virtual, i18next, react-router, jszip, fastbitset, zustand, lucide-react, …).

Components render correctly **today** because the existing bundle still works — the cards in
`catalog/` and the UI kit in `ui_kits/app/` are proof. But any edit to a component source will
break it.

**Fix**: re-run `/design-sync` from Claude Code in the `safe-unfollow` repo. Nothing in this
project needs to change.

---

## While you're there

Two cosmetic items that also live on the sync side:

- The generated `README.md` should link `DESIGN-GUIDE.md` — that file holds the product context,
  voice, visual foundations, iconography and accessibility rules, and is currently unreferenced
  from the entry point an agent reads first.
- The three sync-generated cards (`Button`, `Badge`, `Accordion`) are grouped `general`, while
  the 24 cards added in this project use `Colors` / `Type` / `Spacing` / `Motion` / `Brand` /
  `Components` / `App`. Emitting `Components` for component cards would make the tab consistent.
