# Golden pair — one account, one day, both export formats

Four files. `following` and `followers_1` as Meta wrote them on **2026-08-11**,
in HTML and in JSON, for the same account, from two archives requested minutes
apart:

|             |                                        |
| ----------- | -------------------------------------- |
| HTML source | `raw/real/2026-08-11-en-html-x9g96b0A` |
| JSON source | `raw/real/2026-08-11-en-json-Zzt7gCja` |

`raw/` is gitignored (`.gitignore:117`), so CI can never see the originals.
These extracts exist so the equivalence claim is testable on a machine that has
never held a real export.

## What was changed, and what was not

**Changed: handles only.** Every real username was replaced by `userNNN`
through a single substitution map applied to all four files, so an account that
appears in both lists still appears in both. The account owner's own handle in
the HTML byline was replaced with `account-owner`.

**Not changed: everything else.** Class names, record order, date strings, the
`<base>` tag, the 14.5 KB of inline CSS, whitespace, and the header `<time>`
element. The class names are the drift detector — they have been byte-identical
across five months and three locales while the record model behind them
changed — so normalising them would destroy what the fixture is for.

Two artifacts of the real export are preserved deliberately and are **not**
mistakes to be cleaned up:

- The header reads `<time datetime="2026-08-11T18:42Z">…at 11:42 AM UTC</time>`.
  The visible text is UTC−7 labelled "UTC". Meta's own export contradicts
  itself about time; the per-row dates use a different offset again. Nothing in
  the parser reads the header, and this is why.
- A narrow no-break space (U+202F) sits inside that rendered time.

## Size and selection

25 records per file — the first 25 in the HTML file's own order that the JSON
twin also carries. 31 distinct handles across the 50 records, so **19 mutuals
survive** and the badge set algebra is still exercisable against them.

## The claim these stand in for

Verified over the **full** files when the extracts were cut, not over the
extracts:

| list          | HTML | JSON | symmetric difference |
| ------------- | ---: | ---: | -------------------: |
| `following`   |  413 |  413 |                **0** |
| `followers_1` |  364 |  364 |                **0** |

## Regenerating

There is no committed generator, and that is deliberate: it would need the real
archives, which are gitignored, so a script here could never run in CI and
would rot unnoticed. If these need recutting, the procedure is in this file —
match records by the `href` anchor, substitute handles through one map across
all four files, and assert no real handle survives in any output before
writing.
