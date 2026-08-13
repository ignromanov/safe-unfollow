import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  resolveUsernameLabel,
  resolveUsernameLabelWithMode,
} from '@/core/parsers/instagram-labels';

/**
 * GH#21, Task 1. The 2026-08 export names the username field with a
 * **localised** label: `Username` on an English-language export,
 * `Имя пользователя` on a Russian one — same account, same day. So the field
 * cannot be found by name, and the resolver must be language-independent by
 * construction rather than by having enough translations.
 *
 * These tests exist to prove that. A suite that only covered Russian would
 * prove we handled Russian, so the invented-language cases below carry as much
 * weight as the real ones: they use a label set nobody wrote code against.
 *
 * All usernames, fbids and timestamps here are invented — `raw/` holds real
 * exports and this repository is public.
 */

const FBID = '10000000000000001';

function entry(pairs: ReadonlyArray<readonly [string, string]>): unknown {
  return {
    timestamp: 1_700_000_000,
    media: [],
    label_values: pairs.map(([label, value]) => ({ label, value })),
    fbid: FBID,
  };
}

/**
 * Instagram writes non-ASCII labels as double-encoded UTF-8: the bytes of the
 * UTF-8 string, each taken as a codepoint. `JSON.parse` therefore hands the
 * parser mojibake, not the readable label — confirmed against both August
 * archives. Nothing in the resolver may depend on which of the two it gets.
 */
function doubleEncodeUtf8(text: string): string {
  return Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join('');
}

/** Russian labels, as spelled in the real export. */
const RU_USERNAME = 'Имя пользователя';
const RU_NAME = 'Имя';

/** A language nobody on this team reads and nobody wrote code against. */
const XX_USERNAME = 'Χρήστης';
const XX_NAME = 'Όνομα';

/**
 * Nine records in the shape the real archives have: a username-shaped value
 * under the username label, a human display name under the name label. One
 * record's display name is itself username-shaped — real archives contain
 * these, and they are exactly why a per-entry guess cannot work.
 */
function archive(usernameLabel: string, nameLabel: string): unknown[] {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['sample_user_a', 'A Display Name'],
    ['sample_user_b', 'Another Person'],
    ['sample_user_c', 'Third Person Here'],
    ['sample_user_d', 'Fourth Person'],
    ['sample_user_e', 'Fifth Person'],
    ['sample_user_f', 'Sixth Person'],
    ['sample_user_g', 'Seventh Person'],
    ['sample_user_h', 'Eighth Person'],
    ['sample_user_i', 'ninthperson'],
  ];
  return rows.map(([username, name]) =>
    entry([
      ['URL', ''],
      [nameLabel, name],
      [usernameLabel, username],
    ])
  );
}

/** The one record whose display name is also username-shaped. */
const AMBIGUOUS_SINGLE_ENTRY = (usernameLabel: string, nameLabel: string): unknown =>
  entry([
    ['URL', ''],
    [nameLabel, 'ninthperson'],
    [usernameLabel, 'sample_user_i'],
  ]);

describe('resolveUsernameLabel', () => {
  describe('fast path', () => {
    it('takes an English `Username` label without scoring anything', () => {
      const label = resolveUsernameLabel(archive('Username', 'Name'));
      expect(label).toBe('Username');
    });

    it('accepts a lowercase or padded spelling and returns it verbatim', () => {
      // Returned verbatim because the entry resolver matches the label
      // exactly — re-normalising in two places is how they drift apart.
      expect(resolveUsernameLabel(archive('username', 'Name'))).toBe('username');
      expect(resolveUsernameLabel(archive('  Username  ', 'Name'))).toBe('  Username  ');
    });
  });

  describe('language independence', () => {
    it('resolves Russian labels by scoring, with no Russian anywhere in the code', () => {
      expect(resolveUsernameLabel(archive(RU_USERNAME, RU_NAME))).toBe(RU_USERNAME);
    });

    it('resolves the double-encoded Russian labels the real export actually carries', () => {
      const usernameLabel = doubleEncodeUtf8(RU_USERNAME);
      expect(resolveUsernameLabel(archive(usernameLabel, doubleEncodeUtf8(RU_NAME)))).toBe(
        usernameLabel
      );
    });

    it('resolves an invented language identically', () => {
      expect(resolveUsernameLabel(archive(XX_USERNAME, XX_NAME))).toBe(XX_USERNAME);
    });

    it('does not care about label order within an entry', () => {
      const swapped = archive(XX_USERNAME, XX_NAME).map(row => {
        const record = row as { label_values: unknown[] };
        return { ...record, label_values: [...record.label_values].reverse() };
      });
      expect(resolveUsernameLabel(swapped)).toBe(XX_USERNAME);
    });
  });

  describe('archive-wide pooling', () => {
    it('cannot resolve a single-entry file in isolation', () => {
      // restricted_profiles.json and removed_suggestions.json hold one record
      // each in the real export — and both resolve standalone there, because
      // their display names are not username-shaped. This is the case they do
      // NOT cover: one record where a display name is itself username-shaped,
      // so the margin vanishes. Constructed, not observed.
      const lone = AMBIGUOUS_SINGLE_ENTRY(XX_USERNAME, XX_NAME);
      expect(resolveUsernameLabel([lone])).toBeNull();
    });

    it('resolves that same entry once it is pooled with the rest of the archive', () => {
      // This is the assertion that pins archive-wide scoring rather than
      // per-file scoring. Same record, same labels, different population.
      const lone = AMBIGUOUS_SINGLE_ENTRY(XX_USERNAME, XX_NAME);
      const pooled = [...archive(XX_USERNAME, XX_NAME).slice(0, 8), lone];
      expect(resolveUsernameLabel(pooled)).toBe(XX_USERNAME);
    });
  });

  /**
   * The membership tiebreak, reached only when scoring is genuinely ambiguous.
   * No archive on disk exercises it — English resolves at the fast path and
   * Russian at scoring — so these are the only tests it will ever have.
   */
  describe('membership tiebreak', () => {
    /** Two labels, both 100% username-shaped: scoring alone cannot separate them. */
    function ambiguousPool(): unknown[] {
      return [
        entry([
          [XX_NAME, 'sample_user_a'],
          [XX_USERNAME, 'sample_user_p'],
        ]),
        entry([
          [XX_NAME, 'sample_user_b'],
          [XX_USERNAME, 'sample_user_q'],
        ]),
      ];
    }

    it('breaks the tie toward the label whose values the user actually follows', () => {
      const pooled = ambiguousPool();
      expect(resolveUsernameLabel(pooled)).toBeNull();

      expect(
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['sample_user_p', 'sample_user_q']),
        })
      ).toBe(XX_USERNAME);
    });

    it('returns null when both labels land the same number of hits', () => {
      const pooled = ambiguousPool();
      expect(
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['sample_user_a', 'sample_user_p']),
        })
      ).toBeNull();
    });

    it('returns null when no candidate lands a single hit', () => {
      const pooled = ambiguousPool();
      expect(
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['someone_else_entirely']),
        })
      ).toBeNull();
    });

    it('degrades to null when no known usernames are available at all', () => {
      // following.json missing or unreadable must leave the tiebreak inert,
      // not crash and not guess.
      const pooled = ambiguousPool();
      expect(resolveUsernameLabel(pooled, { tiebreakEntries: pooled })).toBeNull();
      expect(
        resolveUsernameLabel(pooled, { tiebreakEntries: pooled, knownUsernames: new Set() })
      ).toBeNull();
    });

    it('survives a non-string value instead of throwing', () => {
      // The tiebreak reads raw JSON fields too. `tallyLabels` has always
      // guarded this; here and in resolveEntry it was missing.
      const pooled = [
        entry([
          [XX_NAME, 'sample_user_a'],
          [XX_USERNAME, 'sample_user_p'],
        ]),
        { timestamp: 1_700_000_000, label_values: [{ label: XX_USERNAME, value: 42 }] },
      ];
      expect(() =>
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['sample_user_p']),
        })
      ).not.toThrow();
      expect(
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['sample_user_p']),
        })
      ).toBe(XX_USERNAME);
    });

    it('never runs when scoring already produced a clear winner', () => {
      // Scoring says XX_USERNAME (9/9 against 1/9). Membership would say
      // XX_NAME. Scoring is the stronger signal and must not be second-guessed.
      const pooled = archive(XX_USERNAME, XX_NAME);
      expect(
        resolveUsernameLabel(pooled, {
          tiebreakEntries: pooled,
          knownUsernames: new Set(['ninthperson']),
        })
      ).toBe(XX_USERNAME);
    });
  });

  /**
   * A perfect rate on two values is not evidence. The username label is on
   * every record; a label on a handful of them cannot be it, and before the
   * coverage floor such a label tied the true winner and collapsed the
   * resolution for the **whole archive** — all six optional files at once,
   * including the two that feed `notFollowingBack`.
   */
  describe('minimum pool coverage', () => {
    it('resolves despite a sparse label scoring a perfect rate on two values', () => {
      // `URL` is empty on every profile without a bio link, and `normalize`
      // accepts a bare domain — so two link-in-bio values score 2/2 against
      // the username label's 10/10.
      const pooled = Array.from({ length: 10 }, (_unused, index) =>
        entry([
          ['URL', index < 2 ? 'example.link' : ''],
          [XX_NAME, 'A Display Name'],
          [XX_USERNAME, `sample_user_u${index}`],
        ])
      );
      expect(resolveUsernameLabel(pooled)).toBe(XX_USERNAME);
    });

    it('still lets a label covering half the pool block the resolution', () => {
      // The floor prunes sparse labels only. Half is the boundary, and a rival
      // populated that widely is a genuine ambiguity that must still refuse —
      // as must the equally populated pair in `ARRAY_UNREADABLE_ENTRIES`.
      const pooled = Array.from({ length: 10 }, (_unused, index) =>
        entry([
          [XX_NAME, index < 5 ? `sample_user_n${index}` : ''],
          [XX_USERNAME, `sample_user_u${index}`],
        ])
      );
      expect(resolveUsernameLabel(pooled)).toBeNull();
    });
  });

  describe('refuses to guess', () => {
    it('returns null when two labels both score 100%', () => {
      const pooled = [
        entry([
          [XX_NAME, 'sample_user_a'],
          [XX_USERNAME, 'sample_user_b'],
        ]),
        entry([
          [XX_NAME, 'sample_user_c'],
          [XX_USERNAME, 'sample_user_d'],
        ]),
      ];
      expect(resolveUsernameLabel(pooled)).toBeNull();
    });

    it('returns null when the best label clears 90% but not double the runner-up', () => {
      // 10/10 against 6/10: decisive-looking, and still only 1.67x. A label
      // whose values merely tend to look like usernames is not the field.
      const pooled = Array.from({ length: 10 }, (_unused, index) =>
        entry([
          [XX_NAME, index < 6 ? `sample_user_n${index}` : 'A Display Name'],
          [XX_USERNAME, `sample_user_u${index}`],
        ])
      );
      expect(resolveUsernameLabel(pooled)).toBeNull();
    });

    it('returns null when no label clears 90%', () => {
      const pooled = Array.from({ length: 10 }, (_unused, index) =>
        entry([
          [XX_NAME, 'A Display Name'],
          [XX_USERNAME, index < 8 ? `sample_user_u${index}` : 'Not A Username'],
        ])
      );
      expect(resolveUsernameLabel(pooled)).toBeNull();
    });

    it('returns null for entries carrying no label_values at all', () => {
      expect(resolveUsernameLabel([{ title: 'sample_user_a' }, {}, null, 42])).toBeNull();
    });

    it('returns null for an empty pool', () => {
      expect(resolveUsernameLabel([])).toBeNull();
    });

    it('ignores labels whose values are all empty rather than dividing by zero', () => {
      // URL is empty on every profile without a bio link. Left in the pool it
      // scores 0/0, and an undefined rate can sort ahead of a real winner.
      const pooled = Array.from({ length: 3 }, (_unused, index) =>
        entry([
          ['URL', ''],
          [XX_USERNAME, `sample_user_u${index}`],
        ])
      );
      expect(resolveUsernameLabel(pooled)).toBe(XX_USERNAME);
    });
  });
});

/**
 * GH#21, Task 5. `resolveUsernameLabelWithMode` is the same resolution as
 * `resolveUsernameLabel` above, plus a record of *how* it got there — the
 * signal `useFileUpload` reports to telemetry as `usernameLabelResolution`.
 * These tests exercise each of the four modes directly rather than through
 * `resolveUsernameLabel`'s string-only return, which cannot distinguish them.
 */
describe('resolveUsernameLabelWithMode', () => {
  it('reports fast-path when the literal `username` label matches', () => {
    expect(resolveUsernameLabelWithMode(archive('Username', 'Name'))).toEqual({
      label: 'Username',
      mode: 'fast-path',
    });
  });

  it('reports inferred when archive-wide scoring picks a clear winner', () => {
    expect(resolveUsernameLabelWithMode(archive(RU_USERNAME, RU_NAME))).toEqual({
      label: RU_USERNAME,
      mode: 'inferred',
    });
  });

  it('reports inferred when the membership tiebreak decides, not just scoring', () => {
    const pooled = [
      entry([
        [XX_NAME, 'sample_user_a'],
        [XX_USERNAME, 'sample_user_p'],
      ]),
      entry([
        [XX_NAME, 'sample_user_b'],
        [XX_USERNAME, 'sample_user_q'],
      ]),
    ];
    expect(
      resolveUsernameLabelWithMode(pooled, {
        tiebreakEntries: pooled,
        knownUsernames: new Set(['sample_user_p', 'sample_user_q']),
      })
    ).toEqual({ label: XX_USERNAME, mode: 'inferred' });
  });

  it('reports unresolved when label_values entries exist but no label wins', () => {
    // Same ambiguous pool `resolveUsernameLabel` returns null for above — the
    // point here is that null alone cannot tell this apart from an archive
    // with no label_values at all, and the mode must.
    const pooled = [
      entry([
        [XX_NAME, 'sample_user_a'],
        [XX_USERNAME, 'sample_user_b'],
      ]),
      entry([
        [XX_NAME, 'sample_user_c'],
        [XX_USERNAME, 'sample_user_d'],
      ]),
    ];
    expect(resolveUsernameLabelWithMode(pooled)).toEqual({ label: null, mode: 'unresolved' });
  });

  it('reports not-applicable when no entry carries label_values at all', () => {
    expect(resolveUsernameLabelWithMode([{ title: 'sample_user_a' }, {}, null, 42])).toEqual({
      label: null,
      mode: 'not-applicable',
    });
  });

  it('reports not-applicable for an empty pool', () => {
    expect(resolveUsernameLabelWithMode([])).toEqual({ label: null, mode: 'not-applicable' });
  });
});

/**
 * The cheap guard that will actually catch the regression: the next person to
 * see a Russian fixture fail will reach for the literal label first. Scoring is
 * the whole point of this module, and a hardcoded translation would pass every
 * behavioural test above while quietly failing the other ~30 export languages.
 *
 * So: no non-ASCII string literal anywhere in the parsers. The exception is
 * prose the user reads — `description`, `message`, `fix` — which is written
 * with em dashes throughout this codebase and is never compared against export
 * data. Comments are exempt for the same reason and stripped first.
 */
describe('parser sources carry no language-specific label literal', () => {
  const parserDir = resolve(__dirname, '../../../core/parsers');

  /** Fields holding user-facing prose, the only place non-ASCII is expected. */
  const PROSE_ASSIGNMENT = /(?:description|message|fix)\s*:\s*$/;
  const STRING_LITERAL = /'[^'\n]*'|"[^"\n]*"|`[^`]*`/g;
  // eslint-disable-next-line no-control-regex -- the ASCII range is the assertion
  const NON_ASCII = /[^\x00-\x7F]/;

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?:^|[^:])\/\/[^\n]*/gm, '\n');
  }

  it.each(readdirSync(parserDir).filter(name => name.endsWith('.ts')))(
    '%s has no non-ASCII string literal outside user-facing prose',
    fileName => {
      const code = stripComments(readFileSync(resolve(parserDir, fileName), 'utf-8'));
      const offenders: string[] = [];

      for (const match of code.matchAll(STRING_LITERAL)) {
        if (!NON_ASCII.test(match[0])) continue;
        if (PROSE_ASSIGNMENT.test(code.slice(0, match.index))) continue;
        offenders.push(`${fileName}: ${match[0].slice(0, 60)}`);
      }

      expect(offenders).toEqual([]);
    }
  );
});
