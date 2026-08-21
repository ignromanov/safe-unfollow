# Sync advice — findings for the next `/design-sync` run

Deep audit of this uploaded design system against its own sources, docs and manifest.
Supersedes `SYNC-FIXES.md` (its three items are folded in below as S1/S2/S3).

Everything here was verified against files in this project: `_ds_manifest.json`,
`_ds_bundle.css`, `_ds_bundle.js`, `_adherence.oxlintrc.json`, the card HTML and the docs.
Nothing in this project can fix any of it — all of it is generated. Fixes belong in
`ignromanov/safe-unfollow` or in the `/design-sync` tooling.

Priority key: **P0** breaks how the system is used · **P1** makes it misleading ·
**P2** cosmetic / hygiene.

---

## P0-1 — Token extraction captured Tailwind's palette and missed the brand's own tokens

The manifest holds 252 tokens. The 33 semantic tokens the product actually designs with are
**not among them**.

`_ds_bundle.css` has two token layers:

| Layer | Selector | Content | Extracted? |
|---|---|---|---|
| Tailwind theme | `@layer theme { :root, :host }` | `--color-red-50` … `--color-zinc-950`, `--text-*`, `--container-*` | yes, all 252 |
| App theme | plain `:root { --background: … }` (outside any layer, after the `@property` block) | `--background --foreground --card --popover --primary --secondary --muted --accent --destructive --border --input --ring --chart-1…5 --radius --sidebar*` (33) | **no — 0 of 33** |

Consequences that are visible right now:

- `--primary`, `--radius`, `--chart-1…5` — the values `DESIGN-GUIDE.md §3` calls the system —
  are invisible to any tool reading the manifest.
- The Tailwind aliases that *were* captured are aliases, not values:
  `--color-primary: var(--primary)`, `--color-background: var(--background)`, `--color-border:
  var(--border)`. **74 of 252 tokens have a `var()` value** that resolves to nothing outside the
  page, so token swatches render empty.
- The 142 captured colours are the full generated Tailwind ramp (every red/orange/amber/…/zinc
  step the app happened to compile), which reads as the palette while the real palette — one
  264° hue family plus six semantic accents — is absent.

**Fix**: extract custom properties from *every* `:root`/`:host` rule, not only from inside
`@layer theme`; resolve one level of `var()` aliasing so `--color-primary` reports
`oklch(0.6 0.18 264)`; and prefer the aliased-to token as the canonical name when both exist.

## P0-2 — The dark theme is not registered (`themes: []`)

`_ds_bundle.css` carries a full `.dark { … }` block with **32 overrides** covering every
semantic token, and `DESIGN-GUIDE.md` documents the three-way system → light → dark cycle.
The manifest declares no themes, so nothing downstream can offer a dark preview; the
`foundations/color-dark.card.html` swatch card in this project had to be hand-authored.

**Fix**: register `.dark` as a theme scope (`{ name: "dark", selector: ".dark" }`) with its 32
token overrides. This is the same extraction pass as P0-1 — a class-scoped `:root`-equivalent.

## P0-3 — 92 of 95 components exist only as names

`_ds_manifest.json` lists 95 components, each with a `sourcePath` like
`components/general/AccountItem/AccountItem.jsx`. Only three of those directories were emitted:
`Accordion`, `Badge`, `Button`. The other 92 paths point at files that do not exist.

What that costs:

- `README.md` tells the reader "For a specific component,
  `read_file("components/<group>/<Name>/<Name>.prompt.md")`" — true for 3 of 95.
- No `.d.ts`, no prop list, no variant grid for `AccountItem`, `FilterChips`, `ResultsSection`,
  `Wizard`, `UploadZone`, `StatCard`, `Header`, `Hero` — i.e. for every component that is
  actually specific to this product. The three that *were* emitted are the three generic
  shadcn/Radix wrappers.
- `_adherence.oxlintrc.json` can only lint those three; `x-omelette.components` has three
  entries. The adherence rules cannot catch a misuse of any product component.
- It is almost certainly the source of the "92 component source files changed" warning
  (95 − 3 = 92): every component with no file on disk reads as changed, so the stale-bundle
  warning cannot clear even after a clean re-sync.

**Fix**: emit a folder (`.jsx` re-export + `.d.ts` + `.prompt.md` + `.html`) for every component
in the manifest, or stop declaring `sourcePath` for components that were bundle-only. The
current state is the worst of both.

## S3 / P0-4 — Stale bundle with ~68 inlined npm externals

Carried over from `SYNC-FIXES.md` and still true. `_ds_bundle.js` (2.1 MB) inlines Radix UI,
floating-ui, TanStack Virtual, i18next, react-router, jszip, zustand, lucide-react and ~60 more.
Rendering works today; any component edit breaks it because the in-browser bundler cannot
reproduce those externals.

**Fix**: re-run `/design-sync` from Claude Code in the repo. Note that after P0-3 is fixed this
warning should actually clear — today it would re-appear regardless.

---

## P1-1 — `--tw-*` runtime internals are registered as design tokens (S1)

**78 of 252 tokens** are Tailwind v4 runtime internals: `--tw-translate-x`, `--tw-shadow`,
`--tw-ring-shadow`, `--tw-gradient-stops`, `--tw-enter-opacity`, `--tw-border-style`, … They are
emitted inside utility rules and reset in the `*, ::before, ::after, ::backdrop` block. They are
not theme values and must not be offered to a designer.

They also poison classification, because their values are utility-specific:

```
--tw-translate-x : "-50%"                      → kind "spacing"
--tw-translate-y : "calc(var(--spacing) * 0)"  → kind "color"
--tw-ease        →  kind "color"
--tw-backdrop-blur → kind "color"
--blur-md: 12px  →  kind "spacing"
```

Same root cause as the "114 properties under component-style selectors" issue and the 66
"theme scopes" note (`.translate-y-0`, `.-translate-y-1/2`, …) — all three are the same
`--tw-*` leak seen from different angles.

**Fix**: hard-exclude the `--tw-` prefix from token extraction. That alone removes 78 noise
tokens, the 114-property issue and the 66-scope note.

## P1-2 — Unclassifiable tokens (S2)

After the `--tw-*` exclusion, the remainder of the 24 unclassified tokens is small and real:
`--ease-out`, `--ease-in-out`, `--animate-spin|ping|pulse|bounce`, `--aspect-video`,
`--default-transition-duration`, `--default-transition-timing-function`.

**Fix**: classify by prefix in the sync step — `--ease-*`, `--animate-*`,
`--default-transition-*`, `--aspect-*` → `other`; `--tracking-*`, `--leading-*`,
`--default-*font-family` → `font`; `--blur-*` → `other`, not `spacing`. Or emit
`/* @kind … */` comments. Comment-level only; no rendering change.

## P1-3 — `guidelines/` is the product's end-user help centre, not design guidance

`README.md` says: *"`guidelines/` — the design system's own usage guidance (9 docs). Read these
before composing larger layouts."* The nine files are `faq`, `troubleshooting`, `privacy`,
`roadmap`, `tech-spec`, `user-guide`, `instagram-export`, `accessibility`, `index` — the Jekyll
docs site aimed at end users. Only `accessibility.md` is partly design-relevant. An agent told to
read them before composing a layout gets product support copy.

**Fix**: either label the folder honestly in the generated README (`product documentation —
useful for voice and terminology, not for layout rules`) or scope the guideline sweep to
design-intent docs and skip a generic `docs/` site. The genuine design guidance in this repo
lives in the private `safe-unfollow-ai:.claude/` artifacts, which is why `DESIGN-GUIDE.md` had to
be written by hand.

## P1-4 — The generated README is inaccurate at three points

- *"`tokens/*.css` — CSS custom properties"* — there is no `tokens/` directory; tokens are in
  `_ds_bundle.css`. The README says both things, two sections apart.
- *"All 95 components are the real upstream code"* — true of the bundle, false of
  `components/`, where 3 exist (see P0-3).
- `DESIGN-GUIDE.md` — the file holding all product context, voice, visual foundations,
  iconography and a11y rules — is **not linked from `README.md`**, the entry point an agent reads
  first. `SKILL.md` links it; the README does not.

**Fix**: generate paths from what was actually written, and have the README link every
hand-authored companion doc it finds at the root.

## P1-5 — The generated component-card template carries foreign boilerplate

`components/general/Button/Button.html` (and the Badge/Accordion twins) contain:

- Comments about **Grommet** and a **"storybook reference"** and "graded framing … byte-identical
  to what every existing verdict was minted on" — from a different generator's context. They are
  meaningless here and actively confusing to anyone reading the card.
- Hardcoded `background:#fff`, `border:1px solid #e5e7eb`, `font:600 12px system-ui` — a card
  for a design system whose entire point is `--background`/`--border`/Inter, styled with none of
  them, and broken in dark mode.
- Both `styles.css` **and** `_ds_bundle.css` linked, though `styles.css` `@import`s
  `_ds_bundle.css`. 146 KB parsed twice.
- `<!-- @dsCard group="general" -->` with no `name`, `subtitle` or `viewport`, so the three
  sync cards sit in a `general` tab beside the 24 cards added here under
  `Colors`/`Type`/`Spacing`/`Motion`/`Brand`/`Components`/`App`.

**Fix**: strip the template to DS tokens, link `styles.css` only, emit
`group="Components"` plus a `name` and `viewport`, and delete the inherited comments.

---

## P2-1 — Fonts are declared twice and 3 of 4 read as unreferenced

`fonts/fonts.css` declares 11 `@font-face` rules; `_ds_bundle.css` declares the same 11 again.
`styles.css` imports both, so every face is defined twice. `globalCssPaths` then lists all three
files (`fonts/fonts.css`, `_ds_bundle.css`, `styles.css`) — a consumer that links them all
loads everything twice more.

`brandFonts` reports `Inter Variable`, `Plus Jakarta Sans Variable` and `Plus Jakarta Sans` as
`unreferenced`, with only `Inter` `ok` — because the only font token is `--default-font-family`.
Plus Jakarta Sans is the display face for every headline, stat and the wordmark; it is reached
through the `.font-display` utility, which the font-token matcher does not look at.

**Fix**: emit the font faces once (bundle **or** `fonts/fonts.css`, not both); list only the
single entry point in `globalCssPaths`; resolve font references through utility classes
(`.font-display`) as well as tokens, or emit `--font-display` as a real token.

## P2-2 — The compiled-utility trap is undocumented

`_ds_bundle.css` is Tailwind output for the app as it exists. Utilities the app uses are present
(`.rounded-4xl`, `.bg-gradient-brand`, `.text-gradient`, `.no-scrollbar`, `.animate-in`);
anything else is not — verified absent: `.grid-cols-7`, `.gap-11`, `.text-[13px]`. A new layout
written with plausible Tailwind classes silently renders unstyled, with no error.

**Fix**: state this in the generated README, in one line, near the loading instructions. It is
the single most likely way someone builds something broken here.

## P2-3 — Two adherence rules cannot be satisfied

In `_adherence.oxlintrc.json`:

- `Literal[value=/\b\d+px\b/]` → *"Raw px value — use a design-system spacing token via var()"*.
  The system exports exactly one spacing token (`--spacing: 0.25rem`) plus `--container-*`
  widths. There is no px token to switch to, and the app is written in Tailwind utilities, so
  the rule fires on legitimate code with no valid fix.
- The `font-family` rule lists `Inter Variable | Plus Jakarta Sans Variable | Inter | Plus
  Jakarta Sans` but not the mono stack, which `DESIGN-GUIDE.md §3` documents as the system font
  for filenames, license keys and timings.

Minor: the generated prop lists repeat `ref, className, style, children` twice in each selector,
and `Button.prompt.md` leaks React's internal
`DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES` type into the public prop table —
`ref` should be summarised, not expanded.

**Fix**: skip the px rule when the system has no px-scale tokens (or point it at the Tailwind
spacing scale instead); include every family in `fontFamilies`; dedupe the prop selectors;
truncate `ref` types.

## P2-4 — Card grouping

Sync emits `group="general"`; this project's own cards use capitalised, meaningful groups.
Emitting `Components` for component cards makes the picker consistent. (Carried from
`SYNC-FIXES.md`.)

---

## Acceptance checklist for the next run

Run `check_design_system` after the sync and expect:

- [ ] `--primary`, `--radius`, `--chart-1…5` present in the token list with resolved OKLCH values
- [ ] `themes` contains `dark` with its 32 overrides
- [ ] zero `--tw-*` tokens; zero "properties declared under component-style selectors"; zero
      "theme scopes" note
- [ ] zero unclassified tokens
- [ ] every manifest `sourcePath` resolves to a file that exists
- [ ] no "component source files changed" warning
- [ ] `brandFonts` all `ok`
- [ ] README paths match the emitted tree, and link `DESIGN-GUIDE.md`

### What not to change

`DESIGN-GUIDE.md`, `SKILL.md`, `foundations/*.card.html`, `catalog/*.card.html`, `ui_kits/app/`
and `assets/` were authored in this project on top of the sync output. A re-sync should leave
them alone — in particular do not regenerate `README.md` in a way that drops the
`DESIGN-GUIDE.md` link once it is added.
