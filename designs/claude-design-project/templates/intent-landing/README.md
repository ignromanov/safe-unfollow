# Intent landing designs — local copy

Source of truth: Claude Design project `5e633d36-642a-4605-8000-3ecc1eecb00c`,
path `templates/intent-landing/`. Pulled 2026-09-06 via `DesignSync get_file`.

Drawn by Claude Design from `handoff/2026-09-06-brief-intent-landing.md`, **without being
shown our implementation** — that withholding was the point of the exercise. The prose
answers to the brief's Q1–Q11 live beside them in the project, at
`handoff/2026-09-06-answers-intent-landing.md`.

| File | What it is |
|---|---|
| `IntentLanding.dc.html` | the canvas — iframes the four artboards below at fixed coordinates. Not a design itself |
| `IntentMobile.dc.html` | 390 × 3900, the primary artboard. Fold marked at 664px |
| `IntentDesktop.dc.html` | 1100 × 3200. Fold marked at ≈820px (1440×900 minus browser chrome) |
| `IntentProof.dc.html` | the proof card in all three intents side by side, plus four rejected forms |
| `IntentNotes.dc.html` | the reasoning: the A–J obligations in the designer's order, the measured 390px fold table, Q2–Q10 in one line each, and six premises of the brief it argues are wrong |
| `ds-base.js` · `support.js` | Claude Design's own runtime. See provenance below |

Only one page was designed end to end — **`/instagram-pending-follow-requests`** — on the
stated grounds that it is the page with the least room to over-promise, the one whose honest
result is often empty, and the one whose demo is thinnest: "a layout that survives it
survives the other two; the reverse is not true."

## Why these are here

Same reason as `../conversion-audit/`: these existed only in the cloud project. The
conversion redesign was built from prose answers alone, and copy and pixel budgets survived
that while hierarchy and emphasis did not. These pages are shipped code on this branch, so
the artboards are the only record of what an independent reading of the same brief produced.

## The disagreement, which is the deliverable

The brief asked for an independent design precisely so the two could be compared. They order
the first screen differently, and both orders are deliberate:

| | shipped (`src/pages/IntentPage.tsx`) | drawn (`IntentMobile.dc.html`) |
|---|---|---|
| 1 | h1 | h1 |
| 2 | the answer | the answer |
| 3 | **sample preview (proof)** | **CTA**, 48px, marked |
| 4 | CTA | reassurance line |
| 5 | prose sections | "No export yet?" wait card |
| 6 | second CTA | sample preview (proof) |
| 7 | sibling nav | prose · second CTA · sibling nav |

We put the proof before the first button; the design puts the button directly under the
answer and the proof after it. `IntentNotes.dc.html` argues the second explicitly —
obligation E, "everything else is arranged so the distance answer → button is under one
thumb" — and measures the consequence in its own fold table. Nothing here settles which is
right; that is lumen-cro's call and it needs a measurement neither side has.

Two other differences worth naming: the drawn page carries a **"No export yet?" card**
naming the two-minute request and the day-or-more wait before the reader meets it, and it
marks the fold as a dashed rule so the budget is visible in the artboard rather than
asserted about it.

## Defects in these files, found on import — not corrected here

The mirror is faithful, so these are reproduced as they are:

- **`IntentDesktop.dc.html` declares `$preview: {width: 390}`** while its artboard is
  1100px wide — copied from the mobile file. The desktop artboard previews at phone width.
- **`IntentProof.dc.html` has unreachable code.** `renderVals()` does `return { rows }`, and
  a `cards` array holding all three pages' data plus a second `return` sits after it. Harmless
  — every card is written out by hand in the markup — but it is dead, and it reads as the
  data source.
- The `intent-demo-rows.ts` handles are drawn as striped placeholders, by the designer's own
  note, because that file is not in the design project. The eight real handles are on this
  branch and drop in unchanged.

## How to read them

`.dc.html` is Claude Design's component format, parsed by `support.js`. These are **not
runnable from this repo**: `ds-base.js` loads the compiled design system from `../..`, which
in the cloud project is its root and here is `designs/claude-design-project/`, where
`_ds_bundle.js` is deliberately absent (see `../../BACKUP-README.md`). Read them as source,
or open the originals in the design project.

## Runtime provenance — one thing is copied, not fetched

`ds-base.js` was fetched from the project and is byte-identical to `../conversion-audit/ds-base.js`.

⚠️ **`support.js` was copied from `../conversion-audit/`, not downloaded.** It is 68 KB of
generated runtime (`GENERATED from dc-runtime/src/*.ts — do not edit`), and the only route
from the project to disk is through a model's context, where a byte-exact transcription of
minified JavaScript cannot be guaranteed. The identical `ds-base.js` is good evidence the two
template directories carry the same runtime generation — it is not proof. If these artboards
are ever made to render locally, re-fetch `support.js` first.
