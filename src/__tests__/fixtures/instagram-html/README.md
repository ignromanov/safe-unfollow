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

---

# Locale trio — `following.{en,es,ja}.html`

The same account's `following.html` exported **three times minutes apart on
2026-08-25**, in three Meta UI languages. Sources:
`raw/real/2026-08-25-{en-html-sxQFBjYF,es-html-hGW6A2H6,ja-html-Jb0i1oPA}`.

The only variable between these three files is the interface language, which is
what makes them a controlled experiment rather than three samples. Verified over
the full files when the extracts were cut: **393 records in each, in the same
order, with the same set of accounts.** The committed extracts are the first 20,
through one substitution map so the three still agree.

Japanese is the third on purpose, not for coverage. It shares no alphabet, no
month-naming convention and no conventional date field order with the other two,
so anything the parser reads that a translator can touch fails there and nowhere
else.

|                  | en                     | es                     | ja                     |
| ---------------- | ---------------------- | ---------------------- | ---------------------- |
| `<h1>`           | `Following`            | `Seguidos`             | `フォロー中`           |
| first row's date | `Aug 10, 2026 6:32 pm` | `ago 10, 2026 6:32 pm` | `8月 10, 2026 6:32 PM` |

Two properties of that last row are load-bearing for the date parser that does
not exist yet:

- **The meridiem is uppercase in Japanese.** A published forensics conclusion
  said "am/pm always lowercase ASCII, regardless of locale, zero exceptions" —
  true of the four samples it was drawn from and false of the fifth. A
  case-sensitive `(am|pm)` fails on 100% of Japanese rows.
- **Meta's month abbreviations are not CLDR's.** Spanish September is `sep`;
  `Intl.DateTimeFormat('es', { month: 'short' })` gives `sept`. A CLDR table
  would miss those rows silently, because an unparsed date becomes 0 and the
  oldest-timestamp statistic skips zeros.

## Regenerating

There is no committed generator, and that is deliberate: it would need the real
archives, which are gitignored, so a script here could never run in CI and
would rot unnoticed. If these need recutting, the procedure is in this file —
match records by the `href` anchor, substitute handles through one map across
all four files, and assert no real handle survives in any output before
writing.

---

# Grammar C — `close_friends.{html,json}`

The third record model, from the **same two archives as the golden pair above**
— `raw/real/2026-08-11-{en-html-x9g96b0A,en-json-Zzt7gCja}` — so it is the same
account on the same day in both formats.

The two required files write a profile anchor per record. The seven optional
files write a `<table>` of label/value rows, with the date in a trailing div:

| label      | what it holds                           |
| ---------- | --------------------------------------- |
| `Name`     | the display name                        |
| `Username` | the handle                              |
| `URL`      | the account's bio link, when it has one |

Measured across the whole HTML export: the two required files carry 413 and 364
profile anchors and **zero** tables; the optional ones carry 9, 6, 6, 2, 1 and 1
tables and **zero** profile anchors. The two grammars never mix.

That table is the `label_values` shape the 2026-08 JSON export already carries,
rendered as markup — so the transcoded record needs no new reader and no new
label resolution.

## Why this file and not one of the other six

`close_friends` is the only optional file in the archive carrying `URL` rows,
which is the value that must **not** become a profile link — `resolveEntry`
drops `href` for this shape deliberately, because the bio link is whatever the
account put there.

## Redaction

Wider than the golden pair's, because grammar C carries more: `Username`,
`Name`, `fbid` and the owner's handle in the page header all identify a person
and all were substituted through one map applied to both files. Display names
were replaced **character class by character class**, so a name that was
non-ASCII, spaced or emoji-bearing still is — those are the properties a parser
breaks on. Everything else is Meta's bytes: class names, row order, the empty
`URL` value that JSON keeps and HTML omits, timestamps, the inline CSS.

The cutting script refuses to write if any original value survives in either
output.

## The claim these stand in for

Verified over the **full** archives, all eight relationship files, HTML against
JSON — symmetric difference **0** in every one, nothing unresolved, every record
dated:

| file                           | HTML | JSON |
| ------------------------------ | ---: | ---: |
| `following`                    |  413 |  413 |
| `followers_1`                  |  364 |  364 |
| `close_friends`                |    9 |    9 |
| `pending_follow_requests`      |    6 |    6 |
| `recent_follow_requests`       |    6 |    6 |
| `recently_unfollowed_profiles` |    2 |    2 |
| `removed_suggestions`          |    1 |    1 |
| `restricted_profiles`          |    1 |    1 |
