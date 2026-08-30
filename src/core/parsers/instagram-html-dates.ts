/**
 * Reads the per-record date out of an HTML export, without knowing its language.
 *
 * The date is localised human text and the archive carries no machine form of
 * it anywhere: no `data-*`, no `title=`, and the one `<time datetime>` in the
 * document is the file's generation time rather than any row's. So the month
 * has to be read from a word, in a language nobody told us.
 *
 * ## Why the two obvious answers are wrong, measured rather than argued
 *
 * **A CLDR table misses Spanish.** Meta writes September `sep`;
 * `Intl.DateTimeFormat('es', { month: 'short' })` returns `sept` for `es`,
 * `es-ES` and `es-419` alike. That miss is silent — an unparsed date becomes 0,
 * and the statistic those dates feed skips zeros — so a Spanish export would
 * quietly lose about 5% of its rows.
 *
 * **"Truncate the full name to three characters" also fails.** It reproduces
 * both locales we hold ground truth for, and then collapses elsewhere: `fr`
 * juin/juillet, `cs` červen/červenec and `el` Ιουνίου/Ιουλίου each collide at
 * three characters, and `vi` collapses all twelve months to `thá`.
 *
 * We hold ground truth for three locales out of the thirty-odd Meta exports in,
 * and no fixed rule is known to be right for the rest. **So no rule is chosen.**
 *
 * ## What this does instead — fit, do not choose
 *
 * Build candidate month tables at runtime from `Intl` over (locale × form).
 * Keep the candidates that map the file's own tokens **injectively**. If the
 * survivors agree on every token, that is the answer, and the locale never had
 * to be known. If they disagree, or none survives, return `null` and let the
 * caller fail loudly.
 *
 * This is the same move `instagram-labels.ts` already makes for usernames: let
 * the data pick the table, rather than consulting a table of translations. It
 * ships zero locale strings.
 *
 * Verified across the three locales we hold: `en` fits `cldr-short`, `es` needs
 * `prefix3` (CLDR would say `sept`, Meta writes `sep`), `ja` fits `cldr-short`
 * (`1月`…`12月`).
 *
 * The argument for fitting is that **no single form covers every LANGUAGE**,
 * not that none covers these three — `prefix3` does cover all three, measured,
 * and the sentence claiming otherwise was the argument's own counterexample.
 * `prefix3` fails elsewhere and fails hard: `fr` juin/juillet, `cs`
 * červen/červenec and `el` Ιουνίου/Ιουλίου each collide at three characters,
 * and `vi` collapses all twelve to `thá`. `cldr-short` covers those and misses
 * Spanish. Every form is wrong somewhere, which is why the file picks.
 *
 * ⛔ **Add forms, never locales.** A locale we have never seen is covered iff
 * one of the forms fits its tokens. A per-locale branch — a "CJK case", say —
 * reintroduces exactly the translation table this exists to avoid, written
 * against whichever locale we happened to hold a sample of.
 */

/**
 * Languages Meta plausibly exports in, as candidates to fit against.
 *
 * A list of locale CODES, not of translations: nothing here says what any month
 * is called, only which tables `Intl` should be asked to generate. Adding a
 * locale costs one string and no maintenance, and a wrong guess costs nothing
 * because a candidate that does not fit the file's tokens is discarded.
 *
 * Covers the app's ten UI languages, the languages of the measured top markets
 * (US · ID · IN · PH · UK · DE · CA · IT), and the larger European and Asian
 * languages Instagram ships. The export's language is NOT our UI language —
 * someone can read this site in English and have exported in Portuguese — so
 * this list is deliberately wider than `SUPPORTED_LANGUAGES`.
 *
 * **Cross-locale token collisions were called "not a practical risk at this
 * size" here, and that was measured at the wrong size.** The sweep behind it
 * found three colliding tokens (`lip`, `lis`, `srp`, Polish/Czech against
 * Croatian) over files holding many months. A collision only bites when two
 * candidates both fit EVERY token in one file and then disagree, and the fewer
 * tokens a file holds the easier that is — at one token, eight of English's
 * twelve months collided, all of them against forms this module invents by
 * truncation. A one-token file is the date-range export, 26.5% of parses.
 *
 * Two things follow, and both are load-bearing. `fitMonthTable` consults real
 * spellings before invented ones, which removes every collision that was an
 * artefact of truncation. And a claimed-negligible risk gets measured at the
 * input size the product actually sees, not at the size that makes it look
 * negligible.
 */
const CANDIDATE_LOCALES = [
  'en',
  'es',
  'pt',
  'fr',
  'de',
  'it',
  'nl',
  'sv',
  'da',
  'nb',
  'fi',
  'pl',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'hr',
  'sr',
  'sl',
  'el',
  'ru',
  'uk',
  'tr',
  'ar',
  'fa',
  'he',
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'ur',
  'id',
  'ms',
  'th',
  'vi',
  'tl',
  'ja',
  'ko',
  'zh',
] as const;

/**
 * How a month name might have been abbreviated: which `Intl` month option
 * produces it, how many characters of that to keep, and whether the result is
 * a spelling the locale actually writes.
 *
 * A table rather than a pair of conditionals. The two facts about a form were
 * two nested ternaries in two places, so adding one meant finding both — and
 * `.claude/rules/code-style.md` bans the nesting anyway. `numeric` is here for
 * locales that write the month as a bare number, and costs nothing to include.
 *
 * `exact` is the tier, and it exists because the two kinds of form are not
 * equally trustworthy. A CLDR short or long name is a spelling some language
 * really uses; a prefix is one this module INVENTED by truncation, on the
 * hypothesis that Meta abbreviates that way. Finnish `marraskuu` (November)
 * truncated to three characters is `mar`, which is how a token no Finn ever
 * wrote came to outvote English March — see `fitMonthTable`.
 */
interface FormSpec {
  option: Intl.DateTimeFormatOptions['month'];
  keep: number | null;
  exact: boolean;
}

const FORM_SPECS = {
  'cldr-short': { option: 'short', keep: null, exact: true },
  'cldr-long': { option: 'long', keep: null, exact: true },
  numeric: { option: 'numeric', keep: null, exact: true },
  prefix3: { option: 'long', keep: 3, exact: false },
  prefix4: { option: 'long', keep: 4, exact: false },
} as const satisfies Record<string, FormSpec>;

type Form = keyof typeof FORM_SPECS;
const FORMS = Object.keys(FORM_SPECS) as Form[];

/**
 * The 15th, deliberately, and this is the defence rather than a test.
 *
 * `Intl.DateTimeFormat` over `Date.UTC(y, i, 1)` builds a table shifted by a
 * whole month whenever the machine's offset is negative — observed at UTC−3,
 * where asking for August returned Vietnamese `Tháng 7`. `timeZone: 'UTC'`
 * below fixes it, and a mid-month probe makes it unfixable-by-accident too: no
 * offset on Earth is 15 days, so no environment can carry this date across a
 * month boundary even if the option is ever dropped.
 */
const PROBE_DAY = 15;
const PROBE_YEAR = 2026;

/**
 * The row shape, which is locale-invariant: `{Mon} {DD}, {YYYY} {H}:{MM} {ap}`.
 *
 * Field ORDER holds even in Japanese, which conventionally writes year first
 * and does not here — verified against three exports of one account taken
 * minutes apart. The month token is `\S+` because it may be `Aug`, `ago`,
 * `8月`, `Tháng 8` — no, not that last one: a token containing a space would
 * break this, and none of the three locales held writes one. If a language
 * that does turns up, this regex is where it fails, and it fails by returning
 * null rather than by mis-reading.
 */
const ROW_DATE = /^\s*(\S+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*([^\s\d]+))?\s*$/u;

export interface RowDateParts {
  monthToken: string;
  day: number;
  year: number;
  hour: number;
  minute: number;
  /** As written, case included — Japanese writes `PM`, English writes `pm`. */
  meridiem: string | null;
}

/**
 * Split one row's date text into parts, or `null` if it is not the known shape.
 *
 * Deliberately does not resolve the month: that needs the whole file's tokens,
 * and a per-row guess is what a fitted table exists to avoid.
 */
export function splitRowDate(text: string): RowDateParts | null {
  const match = ROW_DATE.exec(text);
  if (!match) return null;

  const [, monthToken, day, year, hour, minute, meridiem] = match;
  if (!monthToken || !day || !year || !hour || !minute) return null;

  return {
    monthToken,
    day: Number(day),
    year: Number(year),
    hour: Number(hour),
    minute: Number(minute),
    meridiem: meridiem ?? null,
  };
}

/** Case and trailing-period differences are not month differences. */
function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\.$/, '');
}

/** One candidate's twelve tokens, or `null` when they are not all distinct. */
function buildCandidate(locale: string, form: Form): Map<string, number> | null {
  const { option, keep }: FormSpec = FORM_SPECS[form];

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { month: option, timeZone: 'UTC' });
  } catch {
    // An environment without this locale's data is not an error; it is one
    // fewer candidate. Every browser answers for at least `en`.
    return null;
  }

  const table = new Map<string, number>();
  for (let month = 0; month < 12; month++) {
    const full = formatter.format(new Date(Date.UTC(PROBE_YEAR, month, PROBE_DAY)));
    const key = normalizeToken(keep === null ? full : full.slice(0, keep));
    // Not injective: two months would answer to one token, so this candidate
    // cannot read a date unambiguously and is discarded rather than ranked.
    if (!key || table.has(key)) return null;
    table.set(key, month);
  }

  return table;
}

/**
 * Every viable (locale × form) table, built once for the worker's lifetime.
 *
 * A pure function of two module constants — no input reaches it — so the answer
 * is the same for every file in every archive. It was previously rebuilt inside
 * `fitMonthTable`, which runs once per relationship file: measured against a
 * real nine-file HTML export, that was 280.9 ms of a 301 ms transcode, **93% of
 * the total**, and it scaled with the number of FILES rather than records — a
 * one-record `custom_lists.html` cost the same 30 ms as a 413-record
 * `following.html`. Built once instead, the same nine files cost 0.51 ms
 * between them.
 *
 * `null` candidates — a locale this environment has no data for, or a form
 * whose twelve tokens are not distinct — are filtered here rather than skipped
 * on every call.
 */
let candidateTables: { exact: Map<string, number>[]; all: Map<string, number>[] } | null = null;

function monthTableCandidates(): { exact: Map<string, number>[]; all: Map<string, number>[] } {
  if (!candidateTables) {
    const built = CANDIDATE_LOCALES.flatMap(locale =>
      FORMS.map(form => ({ form, table: buildCandidate(locale, form) })).filter(
        (c): c is { form: Form; table: Map<string, number> } => c.table !== null
      )
    );
    candidateTables = {
      exact: built.filter(c => FORM_SPECS[c.form].exact).map(c => c.table),
      all: built.map(c => c.table),
    };
  }
  return candidateTables;
}

/** What a set of candidates had to say about one file's tokens. */
type Fit =
  | { kind: 'fitted'; table: Map<string, number> }
  /** Two candidates explain every token and disagree about one of them. */
  | { kind: 'ambiguous' }
  /** No candidate explains every token. */
  | { kind: 'unexplained' };

function fitOver(candidates: Map<string, number>[], observed: ObservedToken[]): Fit {
  const agreed = new Map<string, number>();

  for (const candidate of candidates) {
    const reading = new Map<string, number>();
    for (const { token, key } of observed) {
      const month = candidate.get(key);
      if (month === undefined) break;
      reading.set(token, month);
    }
    // Partial coverage is no coverage: a candidate that explains some tokens
    // and not others is the wrong language, not a nearly-right one.
    if (reading.size !== observed.length) continue;

    for (const [token, month] of reading) {
      const already = agreed.get(token);
      if (already !== undefined && already !== month) return { kind: 'ambiguous' };
      agreed.set(token, month);
    }
  }

  if (agreed.size !== observed.length) return { kind: 'unexplained' };
  return { kind: 'fitted', table: agreed };
}

interface ObservedToken {
  token: string;
  key: string;
}

/**
 * Fit a month table to the tokens this file actually contains.
 *
 * @param tokens the month tokens observed, in any order and with repeats.
 * @returns a map from each observed token, spelled as observed, to its
 *   zero-based month index — or `null` when no candidate covers every token, or
 *   when the ones that do disagree. `null` means "do not date this file", never
 *   "date the rows I could".
 */
export function fitMonthTable(tokens: Iterable<string>): Map<string, number> | null {
  // Normalized once here rather than inside the candidate loop, where it ran
  // for every token against every one of ~199 candidates.
  const observed = [...new Set(tokens)]
    .filter(t => t.trim().length > 0)
    .map(token => ({ token, key: normalizeToken(token) }));
  // No tokens is not a fit with nothing to check — it is no evidence, and a
  // table returned here would be asserted against rows this file does not have.
  if (observed.length === 0) return null;

  const { exact, all } = monthTableCandidates();

  // Spellings a language really writes are consulted first, and this is not an
  // optimization — it decides answers.
  //
  // Injectivity is checked per candidate over twelve months, but agreement is
  // checked over the tokens this FILE holds, so on a small token set a form
  // invented by truncation can shadow a real one. Measured over all 41 locales
  // and 5 forms: for the single token `Mar`, every candidate answers March
  // except Finnish `prefix3`, whose `marraskuu` truncates to `mar` and answers
  // November. Both cover the token, they disagree, and the file went undated.
  //
  // A one-token file is not a corner case, it is the date-range export — the
  // population `relationship_file_truncated` counts at 26.5% of parses. An
  // English export dated only in March lost every date it had, and eight of the
  // twelve English months collide this way.
  //
  // A prefix is still consulted, because Spanish `sep` appears in no CLDR table
  // and only `prefix3` explains it. It is consulted SECOND, which is the whole
  // change: a truncation may supply an answer nothing else has, and may not
  // overrule one that a real spelling already gave.
  const byExact = fitOver(exact, observed);
  if (byExact.kind === 'fitted') return byExact.table;
  // Two real spellings that disagree — `lip`/`lis`/`srp` across pl, cs and hr —
  // is a genuine ambiguity, unresolvable from inside the file. Widening the
  // candidate set can only add more of it, so it is reported as unreadable
  // here rather than settled by candidate order.
  if (byExact.kind === 'ambiguous') return null;

  const byAll = fitOver(all, observed);
  return byAll.kind === 'fitted' ? byAll.table : null;
}

/**
 * One row's instant, in epoch **seconds** — the unit the JSON export carries,
 * so that a transcoded record is indistinguishable from a parsed one.
 *
 * Takes the already-split parts rather than the raw text. The caller has to
 * split the row anyway — once to decide the text IS a date, once to collect its
 * month token for the fit — so accepting a string here made it three splits per
 * dated record where one does. Keeping `RowDateParts` also stops "is this a
 * date" and "what date is it" being two separate readings of one string.
 *
 * @returns `undefined` when the row cannot be read, which the parsers store as
 *   0 and the skew detector then reports as `insufficient-data`.
 */
export function readRowDate(
  parts: RowDateParts,
  table: Map<string, number> | null
): number | undefined {
  if (!table) return undefined;

  const month = table.get(parts.monthToken);
  if (month === undefined) return undefined;

  return Date.UTC(parts.year, month, parts.day, resolveHour(parts), parts.minute) / 1000;
}

/**
 * The 12-hour clock, whose two edge cases are the ones people get wrong: 12 am
 * is hour 0 and 12 pm is hour 12.
 *
 * The meridiem is matched case-insensitively because Japanese writes `AM`/`PM`
 * uppercase — 401 and 400 of one sample's 801 rows. A published forensics
 * conclusion said the opposite ("always lowercase ASCII, zero exceptions"); it
 * was drawn from four samples and false of the fifth.
 *
 * A row with no meridiem is read as a 24-hour clock rather than assumed to be
 * morning.
 */
function resolveHour({ hour, meridiem }: RowDateParts): number {
  if (meridiem === null) return hour;

  const lower = meridiem.toLowerCase();
  if (lower.startsWith('p')) return hour === 12 ? 12 : hour + 12;
  if (lower.startsWith('a')) return hour === 12 ? 0 : hour;
  return hour;
}
