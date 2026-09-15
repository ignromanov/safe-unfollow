import { describe, expect, it } from 'vitest';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/*.json', {
  eager: true,
  import: 'default',
});

/** `src/locales/id/faq.json` → `id`, `faq` — a failure has to name both. */
function localeAndNamespace(path: string): [string, string] {
  const [locale, file] = path.split('/').slice(-2);
  return [locale, file.replace(/\.json$/, '')];
}

const LOCALES = [...new Set(Object.keys(BUNDLES).map(path => localeAndNamespace(path)[0]))].sort();

function bundle(locale: string, namespace: string): Record<string, unknown> | undefined {
  const hit = Object.entries(BUNDLES).find(([path]) => {
    const [l, n] = localeAndNamespace(path);
    return l === locale && n === namespace;
  });
  return hit?.[1];
}

function at(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}

interface ClaimKey {
  /** Bundle file, without `.json`. */
  ns: string;
  /** Dotted path inside it, as segments. */
  path: readonly string[];
  /** What the sentence asserts, and therefore why a stale translation is a false claim. */
  why: string;
  /** The date the ten translations of this key were last read side by side. */
  reviewed: string;
  /** The English sentence as it stood on that date. */
  en: string;
}

/**
 * Claim-bearing keys, watched by comparing each one against the English sentence
 * it was translated from — not by looking for claim words in nine languages.
 *
 * ## The failure this catches, which nothing else here does
 *
 * `monetization-claims.test.ts` reads `docs/`, README and `src/locales/en` in full,
 * and gives the other nine locales one exact-string archive of a claim already
 * retired. Between them they catch a false claim written in English, and the
 * return of one particular archived string anywhere. Neither catches the case that
 * has actually happened twice (GH#82): the English sentence is *rewritten* to drop
 * a claim, the key survives, and nine translations go on making the old claim in
 * their own vocabulary. `faq.withoutDownload` promised the method was "instant";
 * English lost it in `acf726d` and `de`, `fr`, `ja`, `tr` and `ar` said `sofort`,
 * `instantanée`, `即座に`, `anında` and `فورية` for two more commits. Key-set parity
 * cannot see it — the key is present everywhere. The archive cannot see it — the
 * string was never archived.
 *
 * So the subject here is not the translation. It is the English source: when it
 * moves, every translation of it is unreviewed until someone says otherwise, and
 * this file is where they say so.
 *
 * ## Why not a list of banned words per language
 *
 * That is what GH#82 proposed, and it was built and measured on 2026-09-15 before
 * being rejected. Over all ten locales (563 English strings, 5 630 in total), run
 * with a planted claim per locale as a control that fired 10/10:
 *
 * - the issue's own speed table, verbatim, returned **0** matches;
 * - a negation-plus-noun table for the denial class returned **76**, of which the
 *   great majority were substring accidents — `ad` inside `upload`, `no` inside
 *   `anonymous`, and German `Analyse` ("the analysis") matching the noun
 *   *analytics*;
 * - anchored on word boundaries it returned **19**, and all 19 were false. The
 *   reason they were false is the finding: the boundary between a banned denial
 *   and an approved one is semantic, not lexical. "unfollower tracker … without
 *   login" is our product, not surveillance. "не на сервере" — the parse runs in
 *   your browser, not on a server — is the privacy claim itself, stated truly.
 *   "third-party apps you no longer use" is advice about Instagram's apps.
 *
 * A gate of that shape has two futures and both are worse than none: an allowlist
 * of the sentences it keeps misreading, which is the recollection a gate exists to
 * replace, or a standing red that someone deletes. The rule it breaks is the one
 * ruled on 2026-09-14: a gate green over a surface it cannot see reads as
 * correctness.
 *
 * ## What this does not catch, stated rather than left implicit
 *
 * A claim invented directly in a non-English locale, in a key not listed below.
 * Nothing mechanical here can catch that, because catching it means reading the
 * sentence; it belongs to the native-reader queue (GH#172 for `ja`, and the `ar`
 * and `de` hero pass the operator holds), not to a test.
 *
 * And a reviewer who updates `en` and `reviewed` below without opening the nine
 * translations defeats this file completely. `reviewed` is a separate field for
 * exactly that reason: bumping it is a dated claim in a diff, which a reviewer can
 * challenge, rather than a silent edit nobody can tell from a real review.
 *
 * ## Why the English sentence is duplicated here
 *
 * "No copied facts" (CLAUDE.md) bans a second copy that drifts. This is the other
 * thing: a dated snapshot whose *whole job* is to stop matching, the same shape as
 * `ARCHIVED_FALSE_FAQ_FREE_ANSWER` in `monetization-claims.test.ts`. A hash would
 * do the same work and say less — the diff of a changed sentence is what tells the
 * reviewer which nine translations to go and read.
 */
const CLAIM_KEYS: readonly ClaimKey[] = [
  {
    ns: 'faq',
    path: ['items', 'free', 'answer'],
    why: 'states what is free and what is paid — the claim that went false on 2026-07-27',
    reviewed: '2026-09-15',
    en: 'Yes. The analysis is 100% free: every badge, filter and account, with no signup and no limit. Most alternatives charge a monthly subscription. Here, the only thing that costs anything is exporting your filtered list as a file — a one-time unlock, never a subscription, with the price shown on the button. Viewing the list here is always free. Open-source (MIT), and your Instagram export is processed locally in your browser.',
  },
  {
    ns: 'faq',
    path: ['items', 'privacy', 'answer'],
    why: 'names what leaves the device: the export does not, anonymous page analytics do',
    reviewed: '2026-09-15',
    en: "This tracker uses your official Instagram data export (ZIP file) to analyze followers locally in your browser. No login required. Parsing, filtering and search all happen on your device, and your Instagram export stays in this browser. We receive only anonymous page analytics, which you can switch off in the footer. This method is safe because it uses Instagram's official export tool, not password scraping.",
  },
  {
    ns: 'faq',
    path: ['items', 'shareDataSafely', 'answer'],
    why: 'the same subject-naming rule, on the page a sceptical reader reaches for',
    reviewed: '2026-09-15',
    en: "Yes, if the app processes your file locally in your browser and keeps it there. This tracker reads your ZIP entirely on your device: the file itself stays in this browser, and only anonymous page analytics ever leave it. Be wary of cloud-based unfollower trackers that ask you to hand over your ZIP or your Instagram password: those send your file to someone else's machine. Always check that the app works from the official export and asks for no login.",
  },
  {
    ns: 'faq',
    path: ['items', 'betterThanPaid', 'answer'],
    why: 'carries the account limit, the one-time unlock and a real-time claim about rivals',
    reviewed: '2026-09-15',
    en: "For most users, yes. The analysis is free: no signup, no subscription, every account in your export. It needs no login (so no account ban risk), processes your export locally in your browser (maximum privacy), handles 1,000,000+ accounts (most paid apps cap at 100,000), and is open source. Exporting your filtered list as a file is a one-time unlock — paid once, not every month; everything you can see on screen stays free. Paid apps offer real-time monitoring, which requires API access, but that violates Instagram's Terms of Service and risks your account. SafeUnfollow uses the official, safe data export method.",
  },
  {
    ns: 'faq',
    path: ['items', 'downloadTime', 'answer'],
    why: 'the speed claim GH#82 names: rewritten in English, stale in five locales for two commits',
    reviewed: '2026-09-15',
    en: 'Meta typically sends your data within 5-30 minutes via email. Larger accounts or high server load may take up to a few hours. Once you have the ZIP, the analysis runs in your own browser rather than on a server, so there is no queue and no upload wait. Bigger exports naturally take longer to read than small ones.',
  },
  {
    ns: 'faq',
    path: ['items', 'withoutDownload', 'answer'],
    why: 'the other half of that same instance — it held "instant" until `acf726d`',
    reviewed: '2026-09-15',
    en: "No. Instagram doesn't provide a native unfollower list. The only safe methods are: (1) Manually checking followed accounts vs followers, or (2) Using your official data download with this tool. This tracker does method 2 for you, free: no password, no login, no account risk.",
  },
  {
    ns: 'faq',
    path: ['items', 'htmlExport', 'answer'],
    why: 'the format claim #152 reversed — `formatWarning` survived this reversal in ten locales (GH#88)',
    reviewed: '2026-09-15',
    en: "No. SafeUnfollow already reads both formats. HTML exports also work, but JSON is the format we read most reliably, so it's still what the guide recommends. Upload the ZIP you already have.",
  },
  {
    ns: 'hero',
    path: ['subheadline'],
    why: 'the first claim any visitor reads, and the one the SERP snippet borrows',
    reviewed: '2026-09-15',
    en: 'Find out who unfollowed you on Instagram. Free, no login required. Upload your ZIP file, analyze locally. 100% Private.',
  },
  {
    ns: 'upload',
    path: ['loadingTips', 'localProcessing', 'desc'],
    why: 'asserts nothing is uploaded, on the screen where the export is handed over',
    reviewed: '2026-09-15',
    en: 'Parsing happens entirely in your browser — nothing is uploaded.',
  },
  {
    ns: 'wizard',
    path: ['entry', 'trust', 'local'],
    why: 'the same assertion in the guide, where a reader who did not trust the upload screen goes',
    reviewed: '2026-09-15',
    en: 'Your export is read in this browser and never uploaded.',
  },
];

describe('claim-bearing keys are translated from the English sentence on record', () => {
  it('reads every locale on disk', () => {
    // Derived from the bundles, not listed: a new locale directory has to appear
    // here rather than be silently skipped by a hand-written list.
    expect(LOCALES.length).toBeGreaterThan(1);
    expect(LOCALES).toContain('en');
  });

  for (const key of CLAIM_KEYS) {
    const name = `${key.ns}.${key.path.join('.')}`;

    it(`${name} still holds the English sentence last reviewed on ${key.reviewed}`, () => {
      const english = at(bundle('en', key.ns), key.path);

      expect(
        english,
        `${name} is gone from src/locales/en/${key.ns}.json — either restore it, or remove it from CLAIM_KEYS with the reason`
      ).toBeTypeOf('string');

      expect(
        english,
        `${name} changed in English since ${key.reviewed}. That makes all ${LOCALES.length - 1} translations of it unreviewed: read them against the new sentence, fix the ones that still make the old claim, then update \`en\` and \`reviewed\` in this file.`
      ).toBe(key.en);
    });

    it(`${name} exists in every locale`, () => {
      // i18next falls back to the key string, not to English, so a missing key
      // ships a raw dotted path on a live page. Same reason as results-copy-parity.
      const missing = LOCALES.filter(
        locale => typeof at(bundle(locale, key.ns), key.path) !== 'string'
      );

      expect(missing, `${name} is missing from: ${missing.join(', ')}`).toEqual([]);
    });
  }
});
