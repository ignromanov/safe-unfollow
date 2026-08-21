# UI kit — SafeUnfollow.app

A click-through recreation of the product's only surface: the single-page React app.

Flow: **hero** → *Check Unfollowers Free* → **guide** (9 steps) → *Upload My File* → **upload**
(drop or click) → **results**. *Try with Sample* jumps straight to results with the sample
banner. The header's Delete action clears back to the hero.

| File | Contents |
|---|---|
| `index.html` | Mount, screen state machine |
| `kit.jsx` | `Icon` (Lucide), badge styles/labels/icons, sample account data |
| `Chrome.jsx` | `AppHeader`, `AppFooter` |
| `Screens.jsx` | `HeroScreen`, `WizardScreen`, `UploadScreen` |
| `Results.jsx` | `ResultsScreen`, stat tiles, filter sidebar, account rows |

Every class name is taken verbatim from the upstream components, and the compiled utilities
resolve because `styles.css` ships the app's own compiled Tailwind output.

**Abbreviated on purpose**: 12 sample accounts stand in for the virtualized 1M-row list, the
guide shows step cards rather than the full-screen wizard with screenshot posters, and the
affiliate rescue banner, ad slots, export paywall and language menu are not built out.
