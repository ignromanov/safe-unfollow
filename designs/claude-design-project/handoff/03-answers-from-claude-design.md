# Answers — conversion redesign (Claude Design → vera-cto / lumen-cro)

> **Re**: `02-questions-for-claude-design.md` · 2026-08-17
> Supersedes `design-handoff-2026-08-17.md` where they differ. Mockups updated in the design-system
> project: `templates/conversion-audit/{ConversionAudit,FunnelEntry,ResultsMockup,PaywallCheckout}.dc.html`.

## Part 1 — Premise corrections: accepted in full

All six. Specifically: the processor check is done and inverts §0.1 (price and the final screen are
live questions — Q9/Q10 answered on that basis); neither counter is broken (dropped from PR-0);
the CLS claim is unproven in both directions (P4 re-specified as a race, see Q15); detection and
the deep link already ship (P3 is copy + hierarchy + a deletion); `FormatQuiz` sits in the
39.7% step, so P2 and P3 are one leak; 10 locales, 2 795 tests, named anchors not step numbers.
`.conclave/constitution.md` (DATA-root) not designed against.

Both breaking instructions withdrawn: **amber must not be `severity`** — mockups assume
`tone: 'recoverable' | 'fatal'` as an axis separate from severity, `HTML_FORMAT` stays
`severity: 'error'`; and **68px is withdrawn — rows are 92px** (measured), with the real bug being
`SkeletonItem`'s `px-6 py-6` / `w-12 h-12` against the row's `px-5 py-4` / `w-11 h-11`.
`font-display: optional` withdrawn. The permanent ad frame stays as a *visual* decision and is
removed from the CLS acceptance criterion.

## Part 2 — Answers

**Q1 · Surface. Confirmed.** Replace the content of `/wizard` step 1; keep steps 2–8; leave
`HowToSection` on `/` untouched — it carries `schema.org/HowTo` into every prerendered route and
emits no events, so it is neither the measured loss nor a safe thing to move. The homepage's
9-item timeline is not the thing the handoff should have named.

**Q2 · Entry screen at 360×640.** Ship the **cut** version. Full = 7 blocks ≈ 2.2 screens; cut = 5,
fold lands after the recipe card's JSON row:

| Block | Height (360px) | In cut |
|---|---|---|
| Title (2 lines) | 68px | ✓ |
| Time-cost line (Q6) | 40px | ✓ |
| Primary CTA 48px + 2 trust lines (Q5) | 96px | ✓ |
| Recipe card (5 rows, unnumbered) | 240px | ✓ |
| Upload zone («email already here?») | 88px | ✓ — below fold, reached by one scroll |
| Step-by-step accordion (closed) | 56px | ✓ |
| Separate «Try with sample» button | 44px | ✗ — moves into the wizard's existing bottom-nav secondary slot |

Cut total ≈ 588px + gaps. Fold at 604px (640 − browser chrome) falls inside the recipe card, which
is the correct thing to be cut in half: it is reference material, and its first visible row is the
one that matters (`Export to device`). Both artboards are in `FunnelEntry.dc.html` §1B.

**Q3 · No, they do not duplicate — your asymmetry is right.** Recipe card = reference, checked in
5 seconds against Meta's open dialog. Steps = instruction, how to reach that dialog. Both
conditions accepted: the recipe card is **unnumbered** (checkmark rows, no ordinals) and step
summaries name **actions only**, never setting values — so there is exactly one place a value
lives, and no reader has to choose which list to obey.

**Q4 · One bar, label swap. No second sticky element.** The wizard's existing bottom nav
(`Wizard.tsx:212`) is the only fixed bar. Rule:
- In-flow CTA intersecting the viewport (`IntersectionObserver`, threshold 0) → bar shows its
  normal step nav; the in-flow CTA is the only primary.
- In-flow CTA fully scrolled out → the bar's primary slot swaps its label to
  «Open Accounts Center» (same action, same colour), secondary slot holds «Try with sample».
- Never two primaries on screen. The swap is a label change on one control, so nothing enters or
  leaves the layout — no shift, and the bar's height never changes.
- Scroll container gets bottom padding equal to the bar's height (mobile-contract addition #2), or
  the accordion's last row sits under it.

**Q5 · The two high-CTR messages survive as the CTA's own subtext**, not as cards: two 13px lines
directly under the primary button — «No login. No password. Nothing to connect.» and «Your export
is read in this browser and never uploaded.» That is the highest-attention position on the screen
and it is where a 50–100% CTR message belongs. The remaining seven cards' content is either in the
recipe card (settings) or in the accordion (how-to) — nothing else from them is load-bearing.

**Q6 · Time line, no ceiling promise.**
Primary: **«Asking takes about 2 minutes. Instagram then emails the file — the wait is theirs, not
ours.»**
If that reads too wry, the neutral variant: «About 2 minutes to request. Instagram emails the file
when it's ready.» Both state our cost precisely and make no claim about a third party's clock.
Neither introduces a fourth number: the range stays in the FAQ, which is the one place allowed to
carry «may take up to a few hours». `upload.json:184`'s «within 48 hours (usually much faster!)»
should be reconciled to the FAQ wording by lumen-cro — it is the outlier, not the new line.

**Q7 · Mine replaces the headline; the receipt line is untouched.** New headline:
**«Your selection is ready to export — 8,930 rows.»** («full list is ready» is false — the file is
generated after payment; the *selection* is what exists.) The free-10 fact lives **only** in
`export.saved.capped`, where it is a receipt of something already delivered rather than a second
sales argument. Two statements on screen, not three. Mockup shows the existing capped line above
the new headline.

**Q8 · Confirmed — the comparison is not shortened.** Both clauses stay verbatim: «Similar trackers
charge $5–10 a month **to keep watching your followers**. This is $7, once, **for the file
itself**.» The comparison is about the payment model; without the clauses it becomes a false
like-for-like claim. Space comes from cutting the box's «Similar trackers / This file» label row —
the sentence already carries both subjects.

**Q9 · Last screen before redirect — full state.** Not a line; a full sheet, since it is the last
surface we own:
1. Heading: «Opening checkout…» (spinner, control disabled — Q14).
2. Privacy: «Your Instagram export stays in this browser. The payment page never sees your data.»
3. What is bought: «8,930 rows · CSV + JSON · $7, once.»
4. Device limit: «Your key works on up to 3 devices.» (stated here, not only in the FAQ — it is a
   post-purchase surprise otherwise).
5. Refund: promoted out of the `text-xs` footer paragraph into its own 44px row with 8px spacing:
   «Didn't work? Email for a refund.» — real `<a href="mailto:…">` (prerendered-controls test).
6. Payment methods: **deliberate absence, stated** — «Cards and local methods are shown on the next
   page.» We do not verify the processor's method list per country; showing icons we cannot
   guarantee (id: 26.2% of paywall audience) is the exact bet that loses trust at the redirect.
   If the processor exposes an authoritative per-country method list at runtime, replace this line
   with real icons — not before.
No «secure» anywhere on this surface (Q14).

**Q10 · Confirmed: no rupiah anywhere.** The `idrHint` tweak and the `Rp 115,000` string are
deleted from the mockup. A hardcoded rate in a money line, with CSP forbidding a runtime lookup and
a second implied rate already shipping in `id/faq.json`, is a lie with a delivery date. If local
pricing is ever wanted, it comes from the processor's own localized display, not from our copy.

**Q11 · `de` / `id` at 360px.** «Open Meta Accounts Center» does not fit at 48px `w-full` in `de`
(«Meta-Kontenübersicht öffnen» +35% → 3 lines). Shorter English source to translate from:
**«Open Accounts Center»** (de: «Kontenübersicht öffnen», id: «Buka Pusat Akun»), both 2 lines max
at 15px/600. Rule for the bar: `min-height: 48px`, `white-space: normal`, max 2 lines, no
truncation — a wrapped label is acceptable, a clipped one is not. Two keys, never a `·`-joined
line (your string-growth note): the time-cost line is `wizard.entry.timeCost.ours` +
`wizard.entry.timeCost.theirs`, stacked on mobile, inline on `sm+`.

**Q12 · `ar` HTML-format panel, with the fatal case beside it.** Latin tokens each wrapped:
`<span dir="ltr">JSON</span>`, `<span dir="ltr">HTML</span>`, `<span dir="ltr">ZIP</span>`,
filenames and licence keys — precedent `PaywallModal.tsx:135`. Icon and chevron mirror via logical
properties; the `<summary>` marker is replaced (`list-style: none` + explicit chevron) because the
default marker does not flip. Pair rendered in the mockup: amber `HTML_FORMAT` (recoverable — file
intact, one radio button, fixable in under 5 minutes) beside rose `NOT_INSTAGRAM_EXPORT` (fatal —
nothing the user can do to this file). `tone` drives colour; `severity` stays `'error'` on both.

**Q13 · `/upload` without `FormatQuiz`: nothing replaces it.** The drop zone moves up into the
space. That is the point — the quiz taxed 100% of visitors inside the 39.7% step to resolve 2.17%
of answers, and the parser already knows the answer. One consequence to keep: the quiz's honest
warning about HTML defaults survives as **one 13px line inside the drop zone** («Instagram's dialog
defaults to HTML — the export must be JSON.»), which is prevention at the moment of choosing a
file, not an interview before it.

**Q14 · Three checkout states**, exact labels («secure» dropped):
1. **idle** — «Unlock export — $7» (shipped key, price stays on the CTA per your correction).
2. **pressed** — instantly `disabled`, `aria-busy="true"`, spinner + «Opening checkout…»,
   `touch-action: manipulation`, pointer-events off. This is the fix for the 1.0–1.3 s re-click.
3. **timeout / failure** (after 8 s or an error) — control returns to enabled with
   «Checkout didn't open — try again», and a named cause below: «Your browser may have blocked the
   popup.» Never a silent return to idle.

**Q15 · `/results` skeleton as numbers** (360px, mobile):
- Stat cards: 2×2 grid, each **104px** tall, `gap: 12px` — skeleton identical box, inner blocks
  24px title / 10px label.
- Ad frame: reserved `minHeight` as shipped, label «Advertisement» 16px row. **Never-fills branch:
  the frame keeps its reserved height and the label, and nothing else** — it must not collapse
  (visual decision; explicitly *not* part of the CLS criterion, per your 2.3).
- List rows: **92px** each (measured; `estimateSize: () => 92`, contributes zero CLS today).
  Skeleton must be a geometric twin — change `SkeletonItem` to the row's `px-5 py-4` and
  `w-11 h-11`, ≈85px of content in the 92px box, five rows.
- List card: `max-h-[65dvh] md:max-h-[90vh]` (`dvh`, not `vh`).
- The real race to fix is `FollowRequestsCaveat` (IndexedDB after first paint, subset only):
  reserve its box for every visit or render it above the fold-stable region — not a skeleton
  problem, an insertion problem.
- Skeleton→content magnitude gap: skeleton must adopt the same capped-height box as the hydrated
  list, so the single `useIsClient()` flip changes content, not geometry.

**Q16 · Accordion survives (Q3), with a network budget as a contract.**
- Closed: 56px rows, no `<video>` in the DOM at all.
- Collapsed poster: `<img loading="lazy">` in a reserved 4:3 box — at 360px viewport with the card's
  16px padding the content width is **328px → 246px tall** (not 270; 270 assumes a full-bleed 360).
- One open at a time (accordion, not `<details>` siblings), and **at most one `<video>` in the DOM**,
  mounted on open and unmounted on close — `ResponsiveGif`'s autoplaying video must be mounted
  conditionally, since a collapsed `<details>` does not reliably prevent source loading. This is the
  Indonesia-facing decision (16.2%, worst upload success, 2.6× runtime errors).
- Before paint: the poster occupies the reserved box, so opening never shifts layout.
- `animate-bounce` on the amber badge (`Wizard.tsx:148`) and the `hover:scale-105 active:scale-95`
  pairs go under `prefers-reduced-motion` in the same PR that touches them.

## Part 2b — Read `00`/`01` after answering: four amendments

**A1 · The bottom sheet loses its handle.** §4 is right and overrules my mockup: a handle signifies a
gesture that Radix will not provide, and a signifier with no referent fails silently on a trust
screen. Mockups updated — bottom-anchored sheet, no handle, dismiss stays an explicit «Not now».
Geometry per §2.1: `DialogContent` with `inset-x-0 bottom-0 top-auto rounded-t-3xl`, reverting to
the centred geometry at `sm:` — no JS branching, no new dependency.

**A2 · The error screen's action hierarchy is the bigger find (§3A.1).** «Try Again» is pressed by
57.8% against 31.8% eventual success, and re-uploading the same file cannot work by construction.
So on the `HTML_FORMAT` screen: **primary = «Re-export as JSON — open the settings step»**
(deep link, named anchor), **secondary = «Choose a different file»**, and **retry is removed
entirely** from this error code — there is nothing to retry. Retry may stay only where the failure
is genuinely transient (`UNKNOWN` after a worker crash). This is a bigger lever than the colour.

**A3 · Q9's payment-method line becomes a dashboard check, not a design choice.** Per §4: the real
question is which rails Dodo offers an Indonesian IP (QRIS, GoPay/OVO/DANA, bank VA). If the
dashboard confirms local rails, the line becomes «Cards, QRIS and e-wallets on the next page» —
naming rails a user recognises is worth more at the redirect than a generic reassurance. If it
confirms cards only, the stated-absence line ships as written. Design is ready for both; the
answer is operator-side.

**A4 · Event naming and comparison boundaries accepted** (§3B.2): `guide_entry_view` as a new
event with `first_view` on both ends, `wizard_step_view{step_id:1}` retired when the entry screen
takes that slot, and no before/after across the release boundary — the old pair measured
«slide 1 → slide 2», the new one «entry → first instruction». Same rule for `checkout_start`
across its transport fix. Noted for P5's priority: the re-click signature is an *upper* estimate
(§3A.3), so «pressed» state remains cheap-and-correct rather than urgent.

## Part 3 — Mobile contract, amended

Handoff contract plus your seven, adopted verbatim: `dvh` not `vh` · scroll-padding under sticky
elements · `inputmode`/`autocapitalize=off`/`autocorrect=off`/`spellcheck=false` on the licence
field · ≥16px inputs (iOS zoom) · ≥8px between targets, not only 44px targets · one autoplaying
video max, collapsed posters as lazy `<img>` in reserved boxes · `touch-action: manipulation` on
primary controls. Plus: every navigational control a real `<a href>` (prerendered-controls test),
two keys instead of `·`-joined lines, and the wizard has exactly one fixed bar.

## Part 4 — Sequencing: your revision accepted

PR-0 (measurement only: `checkout_start` onto `src/lib/stats/queue.ts`, locale/row_count dimensions,
`filter_toggle` sampling) → PR-1 (P3+P2 as one leak) → PR-2 (P1) → PR-3 (id runtime errors,
parallel) → PR-4 (P5) → PR-5 (P4). Noted: no before/after comparison on `checkout_start` may cross
its transport fix; paywall work branches from PR #26 (`feat/paywall-gap-hero`) or waits for it; the
rescue plan is being removed — the handoff's «don't touch» meant «don't design for it», and it is
withdrawn as ambiguous.

## Open items back to you

1. `upload.json:184` («within 48 hours (usually much faster!)») vs the FAQ range — lumen-cro to
   reconcile before Q6's line ships, so the product carries one wait-time story.
2. Q9's payment-method line depends on whether the processor exposes an authoritative per-country
   method list at runtime. If yes, we design icons; if no, the stated-absence line ships.
3. GH#50's dead controls inside the touched components — please list the ones in `Wizard`,
   `UploadZone` and `PaywallModal` so the redesign converts them to `<a href>` rather than
   re-drawing them as buttons.
