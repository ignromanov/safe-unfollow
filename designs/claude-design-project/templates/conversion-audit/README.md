# Conversion-audit mockups — local copy

Source of truth: Claude Design project `5e633d36-642a-4605-8000-3ecc1eecb00c`,
path `templates/conversion-audit/`. Pulled 2026-08-19 via `DesignSync get_file`.

| File | What it is |
|---|---|
| `ConversionAudit.dc.html` | the audit itself — measured losses, ranked, links to the three mockups |
| `FunnelEntry.dc.html` | §1A hero secondary button · §1B guide entry screen · §1C format-error screens |
| `ResultsMockup.dc.html` | §2A box-reservation rule (CLS) · §2B fast tabs · §2C search |
| `PaywallCheckout.dc.html` | §3A/3B paywall bottom sheet + three button states · Q9 last screen before redirect |

## Why these are here

They were not. The conversion redesign (`.claude/plans/2026-08-17-conversion-redesign/`)
was planned and PR-0…PR-2 were built from the **prose** answers in
`03-answers-from-claude-design.md` alone — the word "mockup" appears zero times in all
five PR plan files, and no `.dc.html` had ever existed on any branch. Copy and pixel
budgets survived that; hierarchy, emphasis and control weights did not. PR-4 and PR-5
reference `PaywallCheckout` and `ResultsMockup` and would have repeated it.

## How to read them

`.dc.html` is Claude Design's component format. These are **not runnable standalone** —
`support.js` and `ds-base.js` are the project's runtime and were deliberately not copied.
Read them as source, or open the originals in the design project. Each mockup's inline
monospace notes carry the reasoning and the Q-number they answer.

## Known divergence from the wizard

`FunnelEntry.dc.html` §1B draws the entry screen as a bare 390px card. The **text** of
Q1 confirms it replaces `/wizard` step 1, but the **artboard** carries no wizard chrome —
no 8-dot stepper, no close control, no bottom nav — because `Wizard` is excluded from the
design sync (`.design-sync/previews/Wizard.tsx.blocked`: it is `fixed inset-0` and escapes
any grid cell). The designer never saw the frame the screen ships inside. Treat the
surface question as open, not settled.
