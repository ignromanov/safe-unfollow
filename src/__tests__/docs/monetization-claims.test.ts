import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

import { noindexRoutes, type VercelHeaderRule } from '../../../scripts/noindex-routes';

const DOCS_ROOT = join(process.cwd(), 'docs');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'assets' ? [] : markdownFiles(full);
    return full.endsWith('.md') ? [full] : [];
  });
}

const DOCS = markdownFiles(DOCS_ROOT).map(path => ({
  name: relative(DOCS_ROOT, path),
  text: readFileSync(path, 'utf-8'),
}));

/**
 * `public/llms.txt` lives outside `docs/`, so it is invisible to every `DOCS`-scoped check
 * below unless explicitly added. Read once, here, so both the pre-existing language-count
 * gate and the llms.txt-specific describe block near the end of this file see the same text.
 */
const LLMS_TXT_PATH = join(process.cwd(), 'public', 'llms.txt');
const LLMS_TXT_EXISTS = existsSync(LLMS_TXT_PATH);
const LLMS_TXT_TEXT = LLMS_TXT_EXISTS ? readFileSync(LLMS_TXT_PATH, 'utf-8') : '';

/**
 * Claims that were true when written and stopped being true without anyone
 * editing the sentence.
 *
 * This is not hypothetical. `84b0cca` had to correct a footer that still said
 * the tool was ad-free eleven days after AdSense went live, and this same
 * roadmap went on claiming "No ads or sponsored content" for longer. A docs
 * page is exactly where a sceptical reader goes to check a promise, so a stale
 * promise there costs more than the revenue that broke it.
 *
 * A blanket denial is banned rather than policed: if a future page needs to say
 * something precise about ads — which surface, which vendor, what they receive —
 * it can, and this test will not object. What it refuses is the sweeping version
 * that goes false the moment any surface is sold.
 *
 * Two entries below carry a bounded gap instead of a literal adjacent phrase,
 * and both exist because of the same class of bug: **an adjacency assumption**
 * — a pattern written as if the words it hunts always sit next to each other,
 * when the copy that actually ships puts something between them. Two instances
 * are on record so far, and the next person adding a pattern here should check
 * for a third before trusting a literal phrase:
 *
 * 1. Negation split from its noun. `/no paywalls?/i` did not match `en/faq.json`
 *    saying "includes no subscriptions, paywalls, or hidden limits" — "no" and
 *    "paywalls" are three words apart. What actually caught that instance was
 *    the archived-string check below (`ARCHIVED_FALSE_FAQ_FREE_ANSWER`), not
 *    this regex, so the four `NEGATION`-based patterns below are closing the
 *    gap after the fact, not proof it is closed for good — a different noun
 *    order, or a negation synonym not in the list, can still slip past.
 * 2. Phrase split by a separator. `/free forever/i` did not match `en/hero.json`
 *    saying "Completely Free • Forever" — a bullet, not a space, sits between
 *    the words. `PHRASE_GAP` closes that one specifically.
 *
 * Both gaps stop at a sentence-ending period so "no ads. $7 unlocks the
 * export." can't bridge two unrelated clauses into a false hit — `NEGATION`'s
 * 60-character bound covers a full negated clause; `PHRASE_GAP`'s 20 is picked
 * to cover " • ", " — " and ", " (2-3 characters) without reaching across an
 * unrelated sentence. That width also catches `docs/roadmap.md` saying
 * "free in full, forever" — a *true* statement (analysis free forever, export
 * paid once) that the pattern cannot tell apart from a blanket one. That is a
 * known false positive, left as a documented limit rather than a narrower
 * bound chosen to make it disappear — narrowing here to dodge one clause would
 * just as easily reopen the "Free • Forever" gap this pattern exists to close.
 *
 * `remains completely free` stays a literal phrase, unwidened: it is written as
 * a sentence clause ("X remains completely free"), not a short badge/tag label
 * like "Free • Forever", and nothing in the corpus splits it with a separator.
 * If that changes, apply the same `PHRASE_GAP` treatment — don't widen it on
 * spec for symmetry with no example driving it.
 *
 * What no pattern here attempts: `en/common.json`'s `cta.tagline`, "100% Free •
 * No Login • Privacy First", contains no "forever" and matches nothing above.
 * Widening anything to catch bare "free" would also flag the many places this
 * project truthfully says the analysis is free. Whether that tagline reads as
 * a blanket claim in its own context is a judgement call for a person, not a
 * gap a regex can close — recorded here so it isn't rediscovered as a bug.
 *
 * A third gap, different in kind from the first two: not a match *shape* the
 * list got wrong, but a noun the list never had at all. `server`, `logs`,
 * `database`, and "data sent anywhere" were simply absent — `footer.description`
 * said "No server, no logs, just your data and your device" and `donation.body`
 * said "No login. No server. No data sent anywhere." in shipped copy, both
 * false at the same vendors (Vercel serves the site and keeps access logs,
 * Umami writes events to a Supabase database, AdSense receives ad requests),
 * and no pattern here could see either sentence because none of those words
 * were in the list to begin with.
 *
 * Name what that means plainly: **this list's coverage is historical, not
 * principled.** It was assembled from the specific incidents someone
 * remembered — an ad-free footer, a free-forever roadmap line — not derived
 * from an inventory of what the product actually runs. It will always be
 * blind to a vendor nobody has thought to name yet. The instruction that
 * follows from that, for whoever ships the next revenue surface or the next
 * data-leaving-the-browser integration: add the noun it falsifies to `BANNED`
 * below in the same change that ships it. Nothing else will prompt that later —
 * this file cannot invent a noun it has never been told about.
 *
 * Three things intentionally not in `BANNED`, each rejected on
 * stated grounds rather than left uncounted:
 *
 * - `login` is not a noun: "No login" is true everywhere it appears (this
 *   product genuinely requires none), and adding it would flag a true claim.
 * - `cloud` was tried and dropped. `NEGATION`/`GAP` cannot tell a claim about
 *   *this product* from a negation and a noun that land in the same sentence
 *   for an unrelated reason — a comparison page's "no login vs password
 *   required, local vs cloud" fired on `cloud` because the word described a
 *   *competitor*, not because this product claims to avoid it. That is not a
 *   bound-width problem like `roadmap.md`'s; no gap size fixes a match
 *   pointed at the wrong subject, so this noun was removed rather than kept
 *   as a known false positive.
 * - `upload` was tried and dropped. The product's own instructions are built
 *   on the bare verb — the route is `/upload`, the CTA says "Upload ZIP", the
 *   wizard's entire job is telling people to upload — so a negation anywhere
 *   nearby fires on instructional copy that asserts nothing:
 *   `"Not sure what to upload? See the guide"` matched because *Not* sits 60
 *   characters from *upload*, not because the sentence denies anything. The
 *   claim actually worth guarding — that this product does not receive what
 *   you upload — is already covered by `server` and `data sent anywhere`;
 *   keeping a noun that fires on instructional copy trains readers to ignore
 *   the file, which is a worse outcome than the coverage gap it would close.
 *
 * The last four entries (`servers`, `logs`, `databases`, `data sent
 * anywhere`) spent six weeks in a separate `LOCALE_ONLY_BANNED` list that ran
 * over `src/locales/en/*.json` only, deferred until
 * `fix/docs-deny-live-third-parties` had finished rewriting `docs/privacy.md`.
 * That branch merged as `ee6b92d` (#67) and the exemption outlived its own
 * stated condition — `docs/index.md` went on saying "No data collection, no
 * tracking, no servers" while the file that bans that sentence skipped the
 * corpus it was written for. Folded back 2026-09-03; the exemption is gone and
 * these run over `DOCS` like everything else.
 *
 * What the fold-back flagged, and what each one turned out to be, because the
 * two kinds are not the same defect:
 *
 * - **False claims, rewritten**: `docs/index.md`'s "No data collection, no
 *   tracking, no servers" and `docs/faq.md`'s "nothing is sent to any server
 *   or stored anywhere" — both blanket, both false since Umami and AdSense
 *   shipped, both narrowed to the claim that is actually true (the Instagram
 *   export is never uploaded).
 * - **A qualifier lost to a line break**: `docs/privacy.md` already said "no
 *   server that receives **your Instagram export**", correctly bounded — but
 *   `qualificationWindow` reads one line, and the noun phrase had wrapped onto
 *   the next one. Fixed by reflowing the source line, not by loosening the
 *   window: widening it would hand every pattern here a longer reach,
 *   including the ones that have been guarding `docs/*.md` all along. Hard
 *   wrapping is why this only bites markdown — a JSON locale string has no
 *   newline to hide the qualifier behind. That fix survives `prettier` only
 *   because `.prettierrc`'s `proseWrap` is left at its default of `preserve`;
 *   setting it to `always` would rewrap these files and could turn a correctly
 *   bounded sentence red. If that ever happens, the sentence is not the bug.
 */
const NEGATION = '\\b(?:no|not|without|zero|never)\\b';
const GAP = '[^.\\n]{0,60}';
const PHRASE_GAP = '[^.\\n]{0,20}';

interface BannedEntry {
  readonly pattern: RegExp;
  readonly why: string;
  readonly qualifiedBy?: RegExp;
}

/**
 * Every entry without `qualifiedBy` treats a match as a violation, full
 * stop — that is correct for them, and stays correct. A handful of entries
 * need more than a match, because of what `docs/roadmap.md` exposed:
 * "Finding your unfollowers is free in full, forever. The only paid item is
 * a one-time $7 unlock…" is not a stale claim, it is the best sentence in
 * the docs on this subject — it states what's free, names the paid item, and
 * gives the price, in one breath. Rewording it to make a heuristic go quiet
 * would make the documentation worse to make the test greener. The FAQ's
 * `shareDataSafely` answer makes the same move a different way: "no servers
 * store or access your data" is true because the sentence has already said
 * *which* data — "your ZIP file". Compare both to `hero.json → trust.free`
 * ("Completely Free • Forever") and `footer.description` ("No server, no
 * logs, just your data and your device"): neither names a paid item, a
 * price, or a subject. Nothing distinguishes the safe strings from the false
 * ones by word count or character distance — that was never the real
 * distinction — only by whether the claim is **qualified**. That was the
 * rule this file's opening comment stated from the start ("if a future page
 * needs to say something precise… it can, and this test will not object")
 * — the patterns only started implementing it here, because this is where a
 * real qualified claim first collided with one of them.
 *
 * One rule, two ways to be qualified — `QUALIFIER_BOUND` is their union:
 *
 * - **Bounded by disclosure**: a price or a named paid item nearby
 *   (`QUALIFIER_DISCLOSURE` — this is what clears `roadmap.md`).
 * - **Bounded by subject**: the claim names *what* it's talking about — "your
 *   ZIP", "the export", "this file", "Instagram data" — rather than leaving
 *   it as an unscoped "your data" (`QUALIFIER_SUBJECT` — this is what clears
 *   `shareDataSafely`, and what `footer.description`'s "your data" fails,
 *   because "your data" is exactly the unscoped phrase that makes a claim
 *   blanket rather than the scoping that would make it safe).
 *
 * `qualifiedBy` marks an entry as needing this check; entries without it are
 * unaffected. A match is qualified when `qualifiedBy` matches inside
 * `qualificationWindow`: the rest of the match's own sentence plus the
 * sentence immediately following, never crossing a newline, and never
 * looking backward from the match. That newline rule does different jobs in
 * the two corpora this file reads: a `docs/*.md` list item is written as one
 * line, so stopping at `\n` keeps the window inside that bullet and out of
 * its neighbours; a `src/locales/en/*.json` string has no newlines in it at
 * all, so the rule just means "the rest of that string" — one JSON value is
 * already its own self-contained unit the way a whole Markdown file is not.
 *
 * State what this cannot do, because it is a proximity heuristic and nothing
 * more: it only looks forward from the match, so a subject named earlier in
 * the same paragraph — or a disclosure two paragraphs away — still reads as
 * unqualified and still fails. That is a deliberate, asymmetric bias, not an
 * oversight: over-flagging a claim that qualifies itself a little too far
 * away is a cheap false positive someone reads past in five seconds.
 * Under-flagging — letting a blanket claim through because *some* disclosure
 * exists somewhere on the page — is the failure this file exists to prevent;
 * that is what happened for three weeks before this file existed. When the
 * two costs conflict, this check is built to pay the cheap one.
 */
function qualificationWindow(text: string, matchIndex: number): string {
  const line = text.slice(matchIndex).split('\n')[0];
  const periodIndexes = [...line.matchAll(/\./g)].map(match => match.index ?? -1);
  const cutoff = periodIndexes[1] === undefined ? line.length : periodIndexes[1] + 1;
  return line.slice(0, cutoff);
}

const QUALIFIER_DISCLOSURE = /\$\d+|one[- ]time|paid (?:item|unlock|feature)/i;
const QUALIFIER_SUBJECT = /\b(?:your|the|this) (?:zip|export|file|instagram data|instagram export)\b/i;
const QUALIFIER_BOUND = new RegExp(`${QUALIFIER_DISCLOSURE.source}|${QUALIFIER_SUBJECT.source}`, 'i');

function isOffendingMatch(text: string, entry: BannedEntry): boolean {
  const match = entry.pattern.exec(text);
  if (!match) return false;
  if (!entry.qualifiedBy) return true;
  return !entry.qualifiedBy.test(qualificationWindow(text, match.index));
}

const BANNED: BannedEntry[] = [
  { pattern: new RegExp(`${NEGATION}${GAP}\\bpaywalls?\\b`, 'i'), why: 'a $7 export unlock is a paywall' },
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\bpremium\\b${GAP}\\bfeatures?\\b`, 'i'),
    why: 'the export is a paid feature',
  },
  { pattern: new RegExp(`${NEGATION}${GAP}\\bads\\b`, 'i'), why: 'AdSense units ship on / and /results' },
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\bsponsored\\b${GAP}\\bcontent\\b`, 'i'),
    why: '/upload carries an affiliate placement',
  },
  { pattern: /remains completely free/i, why: 'the file export is paid' },
  {
    pattern: new RegExp(`\\bfree\\b${PHRASE_GAP}\\bforever\\b`, 'i'),
    why: 'true of the analysis, read as true of everything',
    qualifiedBy: QUALIFIER_BOUND,
  },
  // Gap-3 vocabulary — see the block comment above for why these four exist, why
  // `cloud` and `upload` don't, and why they ran over locales only until 2026-09-03.
  // All four take `qualifiedBy: QUALIFIER_BOUND` for the same reason `free forever`
  // does: a claim that names its subject — "no servers store or access **your ZIP
  // file**" — is a different claim from one that doesn't.
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\bservers?\\b`, 'i'),
    why: 'Vercel serves the site end to end — there is a server',
    qualifiedBy: QUALIFIER_BOUND,
  },
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\blogs?\\b`, 'i'),
    why: 'Vercel keeps access logs and Umami logs every event',
    qualifiedBy: QUALIFIER_BOUND,
  },
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\bdatabases?\\b`, 'i'),
    why: "Umami's events land in a Supabase database",
    qualifiedBy: QUALIFIER_BOUND,
  },
  {
    pattern: new RegExp(`${NEGATION}${GAP}\\bdata\\b${PHRASE_GAP}\\bsent\\b${PHRASE_GAP}\\b(?:anywhere|to)\\b`, 'i'),
    why: 'Umami events and AdSense ad requests are data, and they are sent off-device',
    qualifiedBy: QUALIFIER_BOUND,
  },
];

/**
 * The same failure one document over, found 2026-08-09.
 *
 * `42862d3` swept the docs for claims monetization had falsified and fixed every one
 * it found — but it was reading for *money*. These sentences went false at the same
 * instant, for the same reason, and it walked past them: `privacy.md` denied
 * advertising integrations and tracking cookies, `tech-spec.md` said "No cookies",
 * `roadmap.md` said "No data sharing with external services". All three were false
 * from the day AdSense shipped.
 *
 * They live in this file rather than a new one because they are not a second subject:
 * the class is "a claim that stopped being true without anyone editing the sentence",
 * and the surface that falsifies it is the same revenue surface as above.
 *
 * Same rule as the monetization list: a precise statement about a named third party is
 * allowed and this test will not object. What is banned is the sweeping form, which
 * goes false the moment any third party is added.
 */
const BANNED_PRIVACY = [
  { pattern: /no advertising/i, why: 'AdSense serves ads on / and /results' },
  { pattern: /no tracking cookies?/i, why: 'AdSense sets ad cookies once consent is given' },
  { pattern: /no data sharing/i, why: 'Umami receives events, AdSense receives ad requests' },
  { pattern: /no network requests? after/i, why: 'ad fills, /api/batch and the licence API all run after load' },
];

/**
 * Two privacy policies on one origin drifted apart twice: PR #15 (AdSense) and PR #11
 * (Dodo, affiliates) both updated the React page at /privacy and left this Jekyll copy
 * at /docs/privacy/ asserting the opposite — same domain, opposite claims, both indexed.
 *
 * The fix was to stop having two, so the ceiling below is the actual guard: a page that
 * points at the canonical policy cannot drift from it, and a page that restates the
 * policy will not fit. The old copy was 5,089 bytes. Raising this is allowed, but it has
 * to be a decision, not a side effect.
 */
const CANONICAL_PRIVACY_URL = /safeunfollow\.app\/privacy/;
const COMPARE_DOCS = DOCS.filter(doc => /^compare[\\/]/.test(doc.name));

const DOCS_PRIVACY_MAX_BYTES = 3500;

/**
 * The published docs escaped both of `product.md`'s standing bans: a performance figure
 * stated as measured, and a language count that drifts from `SUPPORTED_LANGUAGES`.
 *
 * Neither is hypothetical — `docs/faq.md` told readers the app was "tested and verified
 * with 1M+ accounts" and quoted "<5ms filtering" as an achieved result, while the only
 * 1M-scale test in the repo mocks IndexedDB entirely and asserts a 500ms ceiling; no
 * benchmark harness exists. Ten `docs/*.md` files independently said "11 languages" (some
 * naming Hindi, retired 2026-08-08) against the real, current count of ten. Both drifted
 * the same way this file's opening comment describes: true when written, false the moment
 * nobody updated the sentence.
 *
 * `PERFORMANCE_BANNED` is a literal-phrase list, not a `NEGATION`-style pattern — there is
 * no true way to say "tested and verified" or "<5ms" as an achieved result on this project,
 * so no `qualifiedBy` exemption exists for it the way `free forever` has one.
 *
 * One page is exempted rather than fixed: `docs/instagram-export.md` is frozen until
 * ~2026-09-15 pending a GSC-driven rewrite (`.claude/plans/2026-09-02-position-content/`
 * task 05) and carries `~5ms` in a table at line 192 — a design target already phrased
 * with `~`, not `<`, so it would not match `<5ms` today, but it is listed here explicitly
 * so the exemption is visible rather than an accident of the regex, and so whoever runs
 * task 05 knows to remove this line in the same change that rewrites the page.
 */
const PERFORMANCE_BANNED_DOCS_EXEMPT = new Set(['instagram-export.md']);

const PERFORMANCE_BANNED: BannedEntry[] = [
  { pattern: /tested and verified/i, why: 'no benchmark harness exists; the 1M-scale test mocks IndexedDB' },
  { pattern: /<\s*5\s*ms/i, why: '<5ms is a design target, not a measurement (product.md → Performance Targets)' },
  { pattern: /sub-5ms/i, why: 'same target, same ban, the marketing-shorthand spelling' },
];

/**
 * A published figure and the caveat that makes it honest belong in one gate.
 *
 * `/docs/roadmap` and `/docs/instagram-export` print the same two metrics — filter speed and
 * search speed at 1M accounts — and until this gate only one of them said they are design
 * targets. `.claude/CLAUDE.md` -> "Performance Targets" forbids restating one as achieved, and
 * a table with a millisecond column and no caveat is exactly that restatement, in the form a
 * reader is most likely to quote back.
 *
 * The clause is READ from roadmap.md rather than written here, so the two pages cannot drift
 * apart the way the tech-spec's own wording already has. Only the sentence both pages can
 * truthfully make is compared: roadmap's paragraph ends with a sentence about its Languages and
 * Tests rows, which instagram-export does not have.
 *
 * Subjects are derived from two conditions, not listed: a page must name the metrics AND print
 * a millisecond figure. `faq.md` names them without a number ("stays interactive") and is
 * correctly out. `tech-spec.md` prints `sub-2ms` without naming them and carries its own,
 * differently-worded disclaimer at its section 5 — recorded, not unified here.
 *
 * ⛔ `PERFORMANCE_BANNED_DOCS_EXEMPT` does not apply. That exemption covers the literal phrases
 * `<5ms` / `sub-5ms`; this page is this rule's subject.
 */
const PERFORMANCE_CLAUSE_END = 'ceiling.';

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The clause both pages must carry, derived from the page that already has it. */
function performanceClause(): string {
  const roadmap = DOCS.find(doc => doc.name === 'roadmap.md');
  expect(roadmap, 'roadmap.md is the source of this clause and was not found').toBeTruthy();
  const collapsed = collapse((roadmap as { text: string }).text);
  const start = collapsed.indexOf('Filter speed and search speed are design targets');
  expect(start, 'roadmap.md no longer carries the clause this rule is derived from').toBeGreaterThan(-1);
  const end = collapsed.indexOf(PERFORMANCE_CLAUSE_END, start);
  expect(end, 'the clause in roadmap.md no longer ends where this rule expects').toBeGreaterThan(-1);
  return collapsed.slice(start, end + PERFORMANCE_CLAUSE_END.length);
}

const NAMES_THE_METRICS = /filter speed|search speed/i;
const PRINTS_MILLISECONDS = /[<~]\s*\d+(\.\d+)?\s*ms\b|\b\d+(\.\d+)?\s*ms\b/i;

describe('a page that prints these two metrics says they are targets', () => {
  const subjects = DOCS.filter(
    doc => NAMES_THE_METRICS.test(doc.text) && PRINTS_MILLISECONDS.test(doc.text),
  );

  it('finds the pages the rule is about', () => {
    // Guards the guard: an empty subject set would pass the loop below silently, which is how
    // a rule that no longer matches anything keeps reporting green.
    expect(subjects.map(doc => doc.name).sort()).toEqual(['instagram-export.md', 'roadmap.md']);
  });

  for (const doc of subjects) {
    it(`${doc.name} carries the design-target clause`, () => {
      expect(
        collapse(doc.text),
        `${doc.name} prints a millisecond figure for filter or search speed with no caveat. ` +
          'Copy the clause from docs/roadmap.md; do not write a new one.',
      ).toContain(performanceClause());
    });
  }
});

/**
 * The same regexes, aimed at shipped product UI instead of docs.
 *
 * `docs/*.md` is the page a sceptical reader checks; `src/locales/en/*.json` is what
 * the product actually says while they are using it, and it drifted the same way:
 * `faq.json` → `items.free.answer` told users the tool "includes no subscriptions,
 * paywalls, or hidden limits" in production, past the same 2026-07-27 monetization
 * date the comment above is about, and this file never looked at it.
 *
 * English only, and every namespace in it, not just `faq`. English is where these
 * claims are first written — the other nine locales are translations of it, and a
 * regex tuned on English words reads as false coverage on Russian, Japanese or
 * Arabic sentences it cannot actually parse. Applying it there would look like a
 * check and would not be one. What those locales get instead is narrower and does
 * not need to read the language — see `ARCHIVED_FALSE_FAQ_FREE_ANSWER` below.
 */
function jsonStringValues(value: unknown, keyPath: string[] = []): Array<{ keyPath: string; text: string }> {
  if (typeof value === 'string') {
    return [{ keyPath: keyPath.join('.'), text: value }];
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      jsonStringValues(child, [...keyPath, key]),
    );
  }
  return [];
}

const LOCALES_ROOT = join(process.cwd(), 'src', 'locales');

function localeDirs(): string[] {
  return readdirSync(LOCALES_ROOT).filter(entry => statSync(join(LOCALES_ROOT, entry)).isDirectory());
}

const EN_LOCALE_DIR = join(LOCALES_ROOT, 'en');
const EN_LOCALE_FILES = readdirSync(EN_LOCALE_DIR)
  .filter(entry => entry.endsWith('.json'))
  .map(entry => {
    const data: unknown = JSON.parse(readFileSync(join(EN_LOCALE_DIR, entry), 'utf-8'));
    return { name: entry, values: jsonStringValues(data) };
  });

function getPath(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}

/**
 * Claim-bearing keys, watched in every locale by a different method than the
 * regexes above: this is an exact-string archive, not a pattern match, because
 * a pattern match is exactly what stops working outside English.
 *
 * Each value below is the real `items.free.answer` string every one of the 10
 * locales — English included — held on 2026-08-17, captured immediately before
 * this claim was rewritten. Freezing it here means a translated copy of the
 * removed claim cannot quietly reappear the next time someone touches a locale
 * file without anyone noticing, even in a language nobody on this check can read.
 *
 * What this guard is blind to, stated plainly rather than left implicit: it
 * cannot catch a *new* false claim invented directly in a non-English locale — it
 * only catches the return of a string that was caught once before, in English,
 * and archived here. It does not understand Arabic, Japanese, or any of the
 * other eight languages it is guarding; it only compares bytes. Start this list
 * small (`faq.items.free.answer`) and extend it if another key earns the same
 * treatment — do not expand the regex approach to non-English text instead.
 */
const ARCHIVED_FALSE_FAQ_FREE_ANSWER: Readonly<Record<string, string>> = {
  ar: 'نعم. هذه الأداة مجانية 100%، مفتوحة المصدر (رخصة MIT)، وبدون اشتراكات أو حواجز دفع أو قيود مخفية. معظم البدائل تتقاضى $5-10/شهر. يستخدم هذا المتتبع تصدير بيانات انستغرام الرسمي المعالج محلياً، مما يلغي تكاليف الخادم تماماً. اعرض كودنا على GitHub.',
  de: 'Ja. Dieses Tool ist 100% kostenlos, Open-Source (MIT-Lizenz), und enthält keine Abonnements, Paywalls oder versteckten Limits. Die meisten Alternativen verlangen 5-10€/Monat. Dieser Tracker verwendet deinen offiziellen Instagram-Datenexport, der lokal verarbeitet wird, und eliminiert Serverkosten vollständig.',
  en: 'Yes. This tool is 100% free, open-source (MIT license), and includes no subscriptions, paywalls, or hidden limits. Most alternatives charge $5-10/month. This tracker uses your official Instagram data export processed locally, eliminating server costs entirely. View our code on GitHub.',
  es: 'Sí. Esta herramienta es 100% gratuita, de código abierto (licencia MIT), y no incluye suscripciones, muros de pago ni límites ocultos. La mayoría de alternativas cobran $5-10/mes. Este rastreador usa tu exportación oficial de datos de Instagram procesada localmente, eliminando costos de servidor por completo.',
  fr: "Oui. Cet outil est 100% gratuit, open source (licence MIT), et n'inclut aucun abonnement, mur payant ou limite cachée. La plupart des alternatives facturent 5-10$/mois. Ce suivi utilise votre exportation officielle de données Instagram traitée localement, éliminant entièrement les coûts serveur.",
  id: 'Ya. Alat ini 100% gratis, open-source (lisensi MIT), dan tidak termasuk langganan, paywall, atau batasan tersembunyi. Kebanyakan alternatif mengenakan biaya Rp75.000-150.000/bulan. Pelacak ini menggunakan ekspor data Instagram resmi Anda yang diproses secara lokal, menghilangkan biaya server sepenuhnya.',
  ja: 'はい。このツールは100%無料、オープンソース（MITライセンス）で、サブスクリプション、有料機能、隠れた制限はありません。ほとんどの代替品は月額500-1000円かかります。このトラッカーは公式Instagramデータエクスポートをローカルで処理し、サーバーコストを完全に排除しています。',
  pt: 'Sim. Esta ferramenta é 100% gratuita, código aberto (licença MIT), e não inclui assinaturas, paywalls ou limites ocultos. A maioria das alternativas cobra R$25-50/mês. Este rastreador usa sua exportação oficial de dados do Instagram processada localmente, eliminando custos de servidor completamente.',
  ru: 'Да. Этот инструмент на 100% бесплатный, с открытым исходным кодом (лицензия MIT), без подписок, платных функций и скрытых ограничений. Большинство альтернатив берут $5-10/месяц. Этот трекер использует ваш официальный экспорт данных Instagram, обрабатываемый локально, полностью исключая серверные расходы.',
  tr: 'Evet. Bu araç %100 ücretsiz, açık kaynaklı (MIT lisansı) ve abonelik, ödeme duvarı veya gizli limit içermez. Çoğu alternatif aylık 5-10$ alır. Bu izleyici, yerel olarak işlenen resmi Instagram veri dışa aktarımınızı kullanarak sunucu maliyetlerini tamamen ortadan kaldırır.',
};

describe('docs monetization claims', () => {
  it('finds documentation to check', () => {
    expect(DOCS.length).toBeGreaterThan(5);
  });

  for (const entry of BANNED) {
    it(`never claims ${String(entry.pattern)} — ${entry.why}`, () => {
      const offenders = DOCS.filter(doc => isOffendingMatch(doc.text, entry)).map(doc => doc.name);

      expect(offenders, `${offenders.join(', ')} — ${entry.why}`).toEqual([]);
    });
  }

  for (const { pattern, why } of BANNED_PRIVACY) {
    it(`never claims ${String(pattern)} — ${why}`, () => {
      const offenders = DOCS.filter(doc => pattern.test(doc.text)).map(doc => doc.name);

      expect(offenders, `${offenders.join(', ')} — ${why}`).toEqual([]);
    });
  }

  /**
   * `docs/is-it-safe.md` tells the reader "We do not publish a browser extension."
   * That sentence is the third of three velum-cdpo approved on 2026-09-03
   * (`decisions/2026-09-03-velum-cdpo-we-license-the-checklist-and-refuse-the-named-claim.md`),
   * deliberately split off from the two permanent ones because it is the
   * reversible one: shipping an extension later falsifies this clause alone. The
   * ruling asks for it to be gated structurally rather than merely written, which
   * is what this is — the day a `manifest_version` artifact lands, this test goes
   * red and whoever added it has to edit the sentence in the same change.
   *
   * The inventory comes from `git ls-files`, not a directory walk, because "in
   * the repo" is what the claim is about and a walk finds vendored copies that
   * are not ours — `.ds-sync/node_modules` alone carries a `manifest.webmanifest`
   * belonging to playwright. The length assertion is not decoration: an empty
   * list from a failed `git` call would otherwise pass this test silently, which
   * is the failure mode the rest of this file exists to prevent.
   */
  it('publishes no browser extension, which is what lets the docs say so', () => {
    const tracked = execSync('git ls-files -z', { cwd: process.cwd(), encoding: 'utf-8' })
      .split('\0')
      .filter(Boolean);

    expect(tracked.length, 'git ls-files returned nothing — the gate could not run').toBeGreaterThan(100);

    const manifests = tracked.filter(file => {
      const name = basename(file);
      return /^manifest.*\.json$/i.test(name) || name.endsWith('.webmanifest');
    });

    const extensionManifests = manifests.filter(file =>
      /"manifest_version"/.test(readFileSync(join(process.cwd(), file), 'utf-8')),
    );

    expect(
      extensionManifests,
      'an extension manifest ships in this repo — docs/is-it-safe.md says we publish none',
    ).toEqual([]);
  });

  it('keeps exactly one privacy policy, and it is not this one', () => {
    const doc = DOCS.find(entry => entry.name === 'privacy.md');

    expect(doc, 'docs/privacy.md exists').toBeDefined();
    expect(doc!.text, 'points at the canonical policy').toMatch(CANONICAL_PRIVACY_URL);
    expect(
      Buffer.byteLength(doc!.text, 'utf-8'),
      'short enough that it cannot be a second policy'
    ).toBeLessThan(DOCS_PRIVACY_MAX_BYTES);
  });

  // The comparison pages are the ones that put a number in a Price row next to a
  // competitor's monthly fee. A reader comparing prices there must be able to
  // see ours, not discover it at a checkout.
  //
  // This assertion used to require `/\$7/` — a fact that stopped being true when #165/#166
  // made the export price per-country, and the ruling of 2026-09-01 bans a numeral for our
  // own price in published copy (an Indonesian or Indian reader is never shown "$7"). That
  // old assertion is exactly the failure this file's own opening comment describes, one
  // level up: a gate that holds a stale fact in place is indistinguishable from a correct
  // gate until you know the fact moved, and it is *worse* than a missing gate because it
  // actively blocks the correction — `docs/roadmap.md` and two `docs/compare/*.md` pages
  // could not be fixed until this line was.
  //
  // The subject set was `/\|\s*\*\*Price\*\*\s*\|/` until 2026-09-03 and broke on task 04, which
  // split that row into "Free" and "Paid" on three pages. A row label is a proxy for "this page
  // presents our offer", and a proxy fails on a copy reshape while the claim it guards is still
  // there — the same shape as the stale fact above, one level milder. The directory is the real
  // subject: every page under `docs/compare/` sells the comparison, so every one of them owes the
  // reader our terms. Derived, so a new page is covered the day it lands.
  it('discloses the export price on every comparison page, without naming our own numeral', () => {
    expect(COMPARE_DOCS.length, 'comparison pages found').toBeGreaterThan(1);
    for (const doc of COMPARE_DOCS) {
      expect(doc.text, `${doc.name} discloses the export is a one-time purchase`).toMatch(/one-time/i);
      expect(doc.text, `${doc.name} must not name our own price as a numeral`).not.toMatch(/\$\s?7\b/);
    }
  });

  it('never states a language count other than SUPPORTED_LANGUAGES.length', () => {
    // public/llms.txt lives outside docs/ but makes the same claim ("Available in 10
    // languages") and is at least as likely to go stale silently — included as a subject
    // here rather than duplicating this check for one more file.
    const subjects = [...DOCS, { name: 'public/llms.txt', text: LLMS_TXT_TEXT }];
    const pattern = /\b(\d+)\s+languages?\b/gi;
    const offenders = subjects.flatMap(doc => {
      const badCounts = [...doc.text.matchAll(pattern)]
        .map(match => Number(match[1]))
        .filter(count => count !== SUPPORTED_LANGUAGES.length);
      return badCounts.length > 0 ? [`${doc.name} (${[...new Set(badCounts)].join(', ')})`] : [];
    });

    expect(
      offenders,
      `${offenders.join(', ')} — the real count is ${SUPPORTED_LANGUAGES.length} (src/config/languages.ts)`,
    ).toEqual([]);
  });

  for (const entry of PERFORMANCE_BANNED) {
    it(`never claims ${String(entry.pattern)} in docs/*.md — ${entry.why}`, () => {
      const offenders = DOCS.filter(
        doc => !PERFORMANCE_BANNED_DOCS_EXEMPT.has(doc.name) && entry.pattern.test(doc.text),
      ).map(doc => doc.name);

      expect(offenders, `${offenders.join(', ')} — ${entry.why}`).toEqual([]);
    });
  }
});

describe('shipped UI copy monetization claims — English locale', () => {
  it('finds English locale files to check', () => {
    expect(EN_LOCALE_FILES.length).toBeGreaterThan(0);
  });

  for (const entry of BANNED) {
    it(`never claims ${String(entry.pattern)} in src/locales/en — ${entry.why}`, () => {
      const offenders = EN_LOCALE_FILES.flatMap(file =>
        file.values
          .filter(({ text }) => isOffendingMatch(text, entry))
          .map(({ keyPath }) => `${file.name}:${keyPath}`),
      );

      expect(offenders, `${offenders.join(', ')} — ${entry.why}`).toEqual([]);
    });
  }
});

describe('shipped UI copy monetization claims — archived-claim regression guard, all locales', () => {
  it('has an archived string for every locale on disk', () => {
    // Not a copied count (see CLAUDE.md "No copied facts") — derived from the
    // directories that actually exist, so a new locale fails loudly here
    // instead of silently skipping the checks below.
    expect(Object.keys(ARCHIVED_FALSE_FAQ_FREE_ANSWER).sort()).toEqual(localeDirs().sort());
  });

  for (const locale of Object.keys(ARCHIVED_FALSE_FAQ_FREE_ANSWER)) {
    it(`${locale}/faq.json items.free.answer exists and is not the archived false claim`, () => {
      const data: unknown = JSON.parse(readFileSync(join(LOCALES_ROOT, locale, 'faq.json'), 'utf-8'));
      const answer = getPath(data, ['items', 'free', 'answer']);

      expect(answer, `${locale}/faq.json items.free.answer is missing`).toBeTypeOf('string');
      expect(answer, `${locale}/faq.json items.free.answer regressed to the archived claim`).not.toBe(
        ARCHIVED_FALSE_FAQ_FREE_ANSWER[locale],
      );
    });
  }
});

/**
 * Comparison pages carry facts about other companies, and those facts expire
 * without notice — the day a rival edits a pricing page, ours is wrong and
 * nothing tells us. velum-cdpo's 2026-09-03 ruling made two rules binding on
 * this directory; both are structural here rather than remembered:
 *
 * 1. A price on the page requires a check date on the page. Without the date a
 *    reader cannot tell a figure read last week from one read last year.
 * 2. No HTML comments. A withheld claim about a named competitor left in a
 *    comment is still served to the client and still findable in view-source,
 *    which is worse than either publishing it or never writing it. The rule is
 *    blanket rather than content-aware on purpose: a gate that tried to judge
 *    which comments are safe would be the recollection this replaces.
 *
 * The subject list is derived from the directory, not enumerated — the class of
 * defect in `progress.md` P1 row 14, where a hand-listed gate passed green while
 * an un-enumerated subject shipped broken.
 */
// `[^\n]`, not `[^.\n]`: the sentence that carries the date usually names the domain it was
// checked on, and a domain contains a period. The stricter class silently failed to match
// "checked on followsback.com's own pages on 2026-09-02" — found by proving this red.
const CHECK_DATE = /checked[^\n]{0,60}?\b\d{4}-\d{2}-\d{2}\b/i;
const CURRENCY_AMOUNT = /[$€£]\s?\d/;

describe('comparison pages state facts about others with an expiry', () => {
  it('finds the comparison pages', () => {
    expect(COMPARE_DOCS.length).toBeGreaterThan(1);
  });

  for (const doc of COMPARE_DOCS) {
    it(`${doc.name} dates any price it states`, () => {
      // The body, not the frontmatter: a date visible only in the `description`
      // meta tag dates the search snippet and not the table the reader is
      // reading. Found the first time this gate was proved red — it passed on a
      // page whose visible copy carried no date at all.
      const body = doc.text.replace(/^---\n[\s\S]*?\n---\n/, '');
      if (!CURRENCY_AMOUNT.test(body)) return;

      expect(
        CHECK_DATE.test(body),
        `${doc.name} names a price but carries no "checked … YYYY-MM-DD" line in its body`,
      ).toBe(true);
    });

    it(`${doc.name} holds no HTML comment`, () => {
      expect(doc.text, `${doc.name} carries an HTML comment, which is served to the client`).not.toMatch(/<!--/);
    });
  }
});

/**
 * `/llms.txt` is a summary of the product written for a machine, which makes it the one
 * published surface most likely to be quoted whole and least likely to be re-read by a human.
 * It gets the same claim discipline as the docs corpus, from the same lists — not a copy of
 * them, the lists themselves.
 *
 * Stricter than the docs rule in one way, deliberately: the `qualifiedBy` exemptions that let a
 * docs page say "free" next to its qualifier are not honoured here. A bullet list has no room
 * for a qualifier, so the unqualified claim simply may not appear.
 */

/**
 * Extracted predicates, not inlined into the `it`s below, for one reason: a control test
 * that duplicates an assertion's logic instead of calling it proves nothing about the
 * assertion — it proves the copy works. Both the real checks and their controls below call
 * these same functions, so a control failing means the real check would have failed too.
 */
const LLMS_TXT_MIN_BYTES = 200;
const LLMS_TXT_MAX_BYTES = 4096;

function withinSizeBudget(byteLength: number): boolean {
  return byteLength > LLMS_TXT_MIN_BYTES && byteLength < LLMS_TXT_MAX_BYTES;
}

function extractDocsLinks(text: string): string[] {
  return [...text.matchAll(/https:\/\/safeunfollow\.app(\/docs\/[A-Za-z0-9/_-]*)/g)].map(
    m => m[1],
  );
}

function docsPermalinks(): Set<string> {
  return new Set(
    DOCS.map(doc => {
      const raw = /^permalink:\s*(.*)$/m.exec(doc.text)?.[1]?.trim() ?? '';
      const clean = raw.replace(/^['"]|['"]$/g, '');
      return `/docs${clean}`.replace(/\/$/, '') || '/docs';
    }),
  );
}

function missingLinks(links: string[]): string[] {
  const permalinks = docsPermalinks();
  return links.filter(link => !permalinks.has(link.replace(/\/$/, '')));
}

function trailingSlashLinks(text: string): string[] {
  return [...text.matchAll(/https:\/\/safeunfollow\.app\/docs\/[A-Za-z0-9/_-]*\//g)].map(
    m => m[0],
  );
}

/**
 * Every `safeunfollow.app` URL named in the text, `/docs/...` or not — unlike
 * `extractDocsLinks`, which is scoped to `/docs/` on purpose (its job is checking those links
 * resolve to a page this repo builds, and `/` and `/upload` are not docs pages). This one exists
 * to catch a different failure: `llms.txt`'s "Start here" block links to `/` and `/upload`
 * today, and nothing stops a future edit from adding `/results` there too — a URL this same
 * branch tells crawlers to discard (`noindex-routes.ts` / `vercel.json`). A machine reader has
 * no way to know that; it would just start pointing at a page we asked it not to index.
 */
function allSafeunfollowLinks(text: string): string[] {
  return [...text.matchAll(/https:\/\/safeunfollow\.app(\/[A-Za-z0-9/_-]*)/g)].map(m => m[1]);
}

/**
 * Read the same way `noindex-routes.test.ts` and the sitemap artefact gate do, rather than
 * listing `/results` and `/sample` a third time.
 */
const VERCEL = JSON.parse(
  readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'),
) as { headers: VercelHeaderRule[] };
const NOINDEXED = noindexRoutes(VERCEL.headers);

const BANNED_ENTRIES = [...BANNED_PRIVACY, ...PERFORMANCE_BANNED];

/**
 * One synthetic sentence per `BANNED_ENTRIES` pattern, paired by position, that pattern
 * MUST match — proof the detector can go red before it is trusted to report green on the
 * real, shipped text. Paired with `BANNED_KNOWN_INNOCENTS` below, which none of the
 * patterns may match, so a widened-to-match-everything regex would also be caught.
 */
const BANNED_KNOWN_VIOLATIONS = [
  'This page carries no advertising of any kind.',
  'We set no tracking cookies, ever.',
  'There is no data sharing with anyone, full stop.',
  'No network requests after the page has finished loading.',
  'This was tested and verified against a real 1,000,000-account export.',
  'Filtering completes in <5ms even at full scale.',
  'Search runs at sub-5ms latency.',
];

const BANNED_KNOWN_INNOCENTS = [
  'The site carries advertising and uses privacy-focused analytics for page-level metrics.',
  'Filter speed and search speed are design targets, not measurements.',
  'Designed for exports up to 1,000,000+ accounts.',
  'Open source under the MIT licence.',
];

describe('llms.txt states nothing the docs corpus may not state', () => {
  it('the size budget can reject an oversized file', () => {
    expect(withinSizeBudget(Buffer.byteLength('x'.repeat(LLMS_TXT_MAX_BYTES), 'utf-8'))).toBe(
      false,
    );
  });

  it('the size budget can reject a near-empty file', () => {
    expect(withinSizeBudget(Buffer.byteLength('too short', 'utf-8'))).toBe(false);
  });

  it('the banned-claim detector can go red on the claims it exists to catch', () => {
    const cannotFire = BANNED_ENTRIES.filter(
      (entry, i) => !entry.pattern.test(BANNED_KNOWN_VIOLATIONS[i]),
    ).map(entry => String(entry.pattern));
    expect(cannotFire, `these patterns did not match their own known violation`).toEqual([]);
  });

  it('the banned-claim detector does not fire on true, hedged copy', () => {
    const falsePositives = BANNED_ENTRIES.filter(entry =>
      BANNED_KNOWN_INNOCENTS.some(innocent => entry.pattern.test(innocent)),
    ).map(entry => String(entry.pattern));
    expect(falsePositives, `these patterns fired on innocent copy`).toEqual([]);
  });

  it('the link-permalink check can reject a link to a page nothing builds', () => {
    expect(missingLinks(['/docs/this-page-does-not-exist'])).toEqual([
      '/docs/this-page-does-not-exist',
    ]);
  });

  it('the link-permalink check accepts a link this repository does build', () => {
    expect(missingLinks(['/docs/faq'])).toEqual([]);
  });

  it('the trailing-slash check can reject a slashed link', () => {
    expect(trailingSlashLinks('See https://safeunfollow.app/docs/faq/ for more.')).toEqual([
      'https://safeunfollow.app/docs/faq/',
    ]);
  });

  it('the trailing-slash check accepts an unslashed link', () => {
    expect(trailingSlashLinks('See https://safeunfollow.app/docs/faq for more.')).toEqual([]);
  });

  it('is published', () => {
    expect(LLMS_TXT_EXISTS, 'public/llms.txt does not exist').toBe(true);
  });

  it('fits the budget a summary file has', () => {
    // 4 KB. Not a standard - a ceiling, so this cannot grow into a second copy of the docs.
    const bytes = Buffer.byteLength(LLMS_TXT_TEXT, 'utf-8');
    expect(withinSizeBudget(bytes), `llms.txt is ${bytes} bytes`).toBe(true);
  });

  for (const banned of BANNED_ENTRIES) {
    it(`makes no claim matching ${banned.pattern}`, () => {
      expect(banned.pattern.test(LLMS_TXT_TEXT), `llms.txt: ${banned.why}`).toBe(false);
    });
  }

  /**
   * Every link is checked against the file that produces the page, not fetched. A fetch would
   * pass against production while this branch links somewhere that does not exist yet, which is
   * the wrong way round for a gate.
   */
  it('links only to docs pages this repository actually builds', () => {
    const links = extractDocsLinks(LLMS_TXT_TEXT);
    expect(links.length, 'llms.txt links to no docs page').toBeGreaterThan(3);
    const missing = missingLinks(links);
    expect(missing, `llms.txt links to pages nothing builds: ${missing.join(', ')}`).toEqual([]);
  });

  it('links to no page through a trailing slash', () => {
    // Same 308 the docs corpus was cleaned of in #184: /docs/faq returns 200, /docs/faq/ redirects.
    const slashed = trailingSlashLinks(LLMS_TXT_TEXT);
    expect(slashed, 'llms.txt links through a redirect').toEqual([]);
  });

  it('the noindex check can reject a link to a page we tell crawlers to discard', () => {
    expect(
      allSafeunfollowLinks('See https://safeunfollow.app/results for the account list.').filter(
        path => NOINDEXED.matches(path),
      ),
    ).toEqual(['/results']);
  });

  it('links to no page this site tells crawlers not to index', () => {
    const offenders = allSafeunfollowLinks(LLMS_TXT_TEXT).filter(path => NOINDEXED.matches(path));
    expect(offenders, `llms.txt links to noindexed page(s): ${offenders.join(', ')}`).toEqual([]);
  });
});
