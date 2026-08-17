import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

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
 * data-leaving-the-browser integration: add the noun it falsifies to `LOCALE_ONLY_BANNED`
 * below in the same change that ships it. Nothing else will prompt that later —
 * this file cannot invent a noun it has never been told about.
 *
 * Three things intentionally not in `LOCALE_ONLY_BANNED`, each rejected on
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
 * `LOCALE_ONLY_BANNED`, not `BANNED`: these four patterns run over
 * `src/locales/en/*.json` only, not `docs/*.md`, on this branch specifically.
 * `docs/privacy.md` alone holds four claims of this exact shape on `main`
 * (one on `fix/docs-deny-live-third-parties`, which is already rewriting them
 * and carries its own `BANNED_PRIVACY` list) — fixing them here would rewrite
 * lines that branch is already rewriting, and the conflict would be resolved
 * by hand for no gain. When `fix/docs-deny-live-third-parties` merges, the
 * next step is one line: fold `LOCALE_ONLY_BANNED` back into `BANNED` and let
 * the assertions run over `DOCS` too — they will go green, or reveal whatever
 * that branch didn't cover.
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
const DOCS_PRIVACY_MAX_BYTES = 3500;

/**
 * Gap-3 vocabulary — see the block comment above for why these four exist and
 * why `cloud` and `upload` don't. Scoped to `src/locales/en/*.json` only, not
 * `docs/*.md`, for the branch reason stated there. All four take
 * `qualifiedBy: QUALIFIER_BOUND` for the same reason `free forever` does: a
 * claim that names its subject — "no servers store or access **your ZIP
 * file**" — is a different claim from one that doesn't, and the difference
 * is not a coincidence of phrasing this list should flag anyway.
 */
const LOCALE_ONLY_BANNED: BannedEntry[] = [
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
  it('discloses the export price on every page that compares prices', () => {
    const priceTables = DOCS.filter(doc => /\|\s*\*\*Price\*\*\s*\|/.test(doc.text));

    expect(priceTables.length, 'comparison pages with a Price row').toBe(3);
    for (const doc of priceTables) {
      expect(doc.text, `${doc.name} states the export price`).toMatch(/\$7/);
    }
  });
});

describe('shipped UI copy monetization claims — English locale', () => {
  it('finds English locale files to check', () => {
    expect(EN_LOCALE_FILES.length).toBeGreaterThan(0);
  });

  for (const entry of [...BANNED, ...LOCALE_ONLY_BANNED]) {
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
