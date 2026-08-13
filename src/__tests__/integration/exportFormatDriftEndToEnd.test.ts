import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { buildAccountBadgeIndex } from '@/core/badges';
import {
  classicValueEntry,
  titleOnlyEntry,
  labelValuesEntry,
  relationshipsWrapper,
  ENGLISH_LABELS,
  INVENTED_LABELS,
  type DriftLabelSet,
} from '../fixtures/instagram-format-drift';

/**
 * GH#33 / GH#21 Task 4: a real ZIP, built with the real `jszip` package (not
 * the `__mocks__/jszip.cjs` double the rest of this suite uses), walked
 * through the actual `parseInstagramZipFile` entry point. Every other test in
 * this codebase exercises the parser through a mock or a unit under test —
 * this file is the one place that proves the pieces still fit together once
 * `JSZip.loadAsync()` has round-tripped the bytes.
 *
 * `parseInstagramZipFile` is typed to take a `File`. jsdom's `File`/`Blob`
 * does not round-trip through JSZip and produces a false `CORRUPTED_ZIP` —
 * measured while writing this file, matching the note left in
 * `04-fixtures-and-regression.md`. Passing the raw `Uint8Array` sidesteps that;
 * everything after `JSZip.loadAsync()` is identical either way, so the cast
 * below is the point, not a workaround around it.
 */

const BASE_PATH = 'connections/followers_and_following';

async function buildZip(files: Record<string, unknown>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, payload] of Object.entries(files)) {
    zip.file(`${BASE_PATH}/${name}`, JSON.stringify(payload));
  }
  return zip.generateAsync({ type: 'uint8array' });
}

async function parseZip(files: Record<string, unknown>) {
  const bytes = await buildZip(files);
  // See file-level docblock: File/Blob round-tripping through JSZip is what
  // jsdom cannot do, so the Uint8Array is passed straight through.
  return parseInstagramZipFile(bytes as unknown as File);
}

/**
 * A mixed-era export: `following.json` on the 2026-01 title-only shape,
 * `followers_1.json` still classic, and all six optional files on the 2026-08
 * `label_values` shape — the exact mix `00-plan.md` measured in
 * `raw/connections-2026-08-11/`. `pending_follow_requests.json` additionally
 * uses the `{relationships_x: [...]}` wrapper and `restricted_profiles.json`/
 * `removed_suggestions.json` the bare-single-object wrapper, so all three
 * wrapper shapes from the task brief are exercised in one archive, the way a
 * real export actually mixes them.
 *
 * `carol_pending` is deliberately in both `following.json` and
 * `pending_follow_requests.json` — the badge-level regression this task
 * exists for: a pending outgoing request must not read as `notFollowingBack`.
 */
function mixedEraFiles(labels: DriftLabelSet): Record<string, unknown> {
  return {
    'following.json': [
      titleOnlyEntry('alice_f'),
      titleOnlyEntry('bob_f'),
      titleOnlyEntry('carol_pending'),
    ],
    'followers_1.json': [classicValueEntry('alice_f'), classicValueEntry('erin_follower')],
    'pending_follow_requests.json': relationshipsWrapper('relationships_follow_requests_sent', [
      labelValuesEntry('carol_pending', { labels }),
    ]),
    'recent_follow_requests.json': [labelValuesEntry('dave_permanent', { labels })],
    'restricted_profiles.json': labelValuesEntry('frank_restricted', { labels }),
    'close_friends.json': [
      labelValuesEntry('grace_close', { labels }),
      labelValuesEntry('henry_close', { labels }),
    ],
    'recently_unfollowed_profiles.json': [labelValuesEntry('ivan_unfollowed', { labels })],
    'removed_suggestions.json': labelValuesEntry('judy_dismissed', { labels }),
  };
}

describe.each<[string, DriftLabelSet]>([
  ['English labels', ENGLISH_LABELS],
  ['invented non-English labels', INVENTED_LABELS],
])('mixed-era export, %s', (_label, labels) => {
  it('parses all eight ParsedAll collections identically regardless of label language', async () => {
    const result = await parseZip(mixedEraFiles(labels));

    expect(result.hasMinimalData).toBe(true);
    expect(result.data.following).toEqual(new Set(['alice_f', 'bob_f', 'carol_pending']));
    expect(result.data.followers).toEqual(new Set(['alice_f', 'erin_follower']));
    expect([...result.data.pendingSent.keys()]).toEqual(['carol_pending']);
    expect([...result.data.permanentRequests.keys()]).toEqual(['dave_permanent']);
    expect([...result.data.restricted.keys()]).toEqual(['frank_restricted']);
    expect([...result.data.closeFriends.keys()].sort()).toEqual(['grace_close', 'henry_close']);
    expect([...result.data.unfollowed.keys()]).toEqual(['ivan_unfollowed']);
    expect([...result.data.dismissedSuggestions.keys()]).toEqual(['judy_dismissed']);

    // Timestamp seam: resolveEntry reads it from two different places
    // depending on shape — `item?.timestamp` on the classic path,
    // `labelled.timestamp` at the entry root on label_values. `.keys()`
    // alone never inspects the value, so a dropped root-level read would
    // leave every assertion above green. `grace_close` is label_values-only.
    expect(result.data.closeFriends.get('grace_close')).toBe(1_700_000_000);
  });

  it('does not badge a pending outgoing request as notFollowingBack', async () => {
    const result = await parseZip(mixedEraFiles(labels));
    const badges = buildAccountBadgeIndex(result.data);
    const byUsername = new Map(badges.map(account => [account.username, account.badges]));

    // The regression this task exists for: following + pendingSent together
    // must not also carry notFollowingBack (core/badges/index.ts:23).
    const carol = byUsername.get('carol_pending');
    expect(carol?.following).toBeTruthy();
    expect(carol?.pending).toBeTruthy();
    expect(carol?.notFollowingBack).toBeUndefined();

    // Controls, so a mutation that disables the whole filter still gets
    // caught: bob_f has no pending/permanent request and must still be
    // notFollowingBack, and alice_f (mutual) must carry neither.
    expect(byUsername.get('bob_f')?.notFollowingBack).toBe(true);
    expect(byUsername.get('alice_f')?.notFollowingBack).toBeUndefined();
    expect(byUsername.get('alice_f')?.mutuals).toBe(true);
    expect(byUsername.get('erin_follower')?.notFollowedBack).toBe(true);
  });
});

/**
 * Every one of the eight relationship files in the 2026-08 shape, including
 * `following.json` and `followers_1.json` — which have not drifted in any
 * archive on disk, but are documented (`00-plan.md` open question 1,
 * `instagram-labels.ts` "Scope seam") as the same serialiser's next likely
 * target. Added 2026-08-12: the mixed-era case above leaves both required
 * files on the classic shape, so nothing proved what the fully-migrated
 * export does. See the `describe` block below for what running this against
 * real code found, and GH#40 ("Username-label resolution covers six of eight
 * relationship files") for the tracked follow-up.
 */
function allNewShapeFiles(): Record<string, unknown> {
  const labels = ENGLISH_LABELS;
  return {
    'following.json': [
      labelValuesEntry('kate_following', { labels }),
      labelValuesEntry('leo_mutual', { labels }),
    ],
    'followers_1.json': [
      labelValuesEntry('leo_mutual', { labels }),
      labelValuesEntry('mia_follower', { labels }),
    ],
    'pending_follow_requests.json': [labelValuesEntry('noah_pending', { labels })],
    'recent_follow_requests.json': [labelValuesEntry('owen_permanent', { labels })],
    'restricted_profiles.json': labelValuesEntry('paula_restricted', { labels }),
    'close_friends.json': [labelValuesEntry('quinn_close', { labels })],
    'recently_unfollowed_profiles.json': [labelValuesEntry('rosa_unfollowed', { labels })],
    'removed_suggestions.json': labelValuesEntry('sam_dismissed', { labels }),
  };
}

describe('fully-migrated export — every file on the 2026-08 label_values shape', () => {
  /**
   * Measured, not assumed: `following.json` and `followers_1.json` do NOT
   * resolve any accounts here. This is `instagram-labels.ts`'s documented
   * "Scope seam" — `01-label-values-entries.md` explicitly told task 1 to
   * pool the username label across only the six optional files and "leave
   * the seam visible" rather than build the eight-file pass now. It is not
   * a missed call site: `resolveEntryList`/`resolveEntry` (tasks 1-2)
   * correctly recognise the shape (`formatUnreadable: false`,
   * `unreadableItemCount: 2` on both required files' `FileExpectation`) —
   * what's missing is a resolved label to read the entries *with*, and that
   * is deliberately not built yet. Tracked as **GH#40** — "[tech-debt]
   * Username-label resolution covers six of eight relationship files — the
   * required two fail loudly instead". If you're reading this because this
   * test just turned red, GH#40 is the work, not a regression to revert.
   *
   * The subject of this test is not "does it parse" — it doesn't, by design
   * — but "does the gap announce itself". Task 3 exists so that a required
   * file which is present, well-formed, and unreadable produces a loud,
   * severity-`'error'` failure (`UNRESOLVED_ENTRIES_FOLLOWING`/`_FOLLOWERS`,
   * routed to `DiagnosticErrorScreen` by `UploadZone.hasCriticalError`)
   * instead of a results list where every follower is silently mislabelled
   * `notFollowedBack`. `close_friends.json` resolving in the very same
   * export (the second `it` below) is what pins that asymmetry — required
   * vs. optional — as intentional rather than a general failure to read the
   * shape at all.
   *
   * When GH#40 lands and the resolver spans all eight files, this test
   * SHOULD start failing — that failure is the signal to update it on
   * purpose, not a regression to chase. Loosening this test instead of
   * updating it defeats its point.
   */
  it('a well-formed but unreadable required file fails loudly (severity error), not silently as zero data — GH#40', async () => {
    const result = await parseZip(allNewShapeFiles());

    expect(result.data.following).toEqual(new Set());
    expect(result.data.followers).toEqual(new Set());
    expect(result.hasMinimalData).toBe(false);

    // The load-bearing assertions: severity, not just presence. `zeros`
    // alone would pass even if the entry-level diagnosis were silenced —
    // pre-task-3 code produced the identical following/followers/
    // hasMinimalData values here, just with no way to tell "unreadable"
    // from "genuinely empty". See the mutation check in the task report.
    const followingWarning = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWING');
    const followersWarning = result.warnings.find(w => w.code === 'UNRESOLVED_ENTRIES_FOLLOWERS');
    expect(followingWarning?.severity).toBe('error');
    expect(followersWarning?.severity).toBe('error');

    const followingExpectation = result.discovery.files.find(f => f.name === 'following.json');
    expect(followingExpectation?.formatUnreadable).toBe(false);
    expect(followingExpectation?.unreadableItemCount).toBe(2);
  });

  it('resolves all six optional files in the same export — the required/optional asymmetry is intentional, not a general failure to read the shape', async () => {
    const result = await parseZip(allNewShapeFiles());

    expect([...result.data.pendingSent.keys()]).toEqual(['noah_pending']);
    expect([...result.data.permanentRequests.keys()]).toEqual(['owen_permanent']);
    expect([...result.data.restricted.keys()]).toEqual(['paula_restricted']);
    expect([...result.data.closeFriends.keys()]).toEqual(['quinn_close']);
    expect([...result.data.unfollowed.keys()]).toEqual(['rosa_unfollowed']);
    expect([...result.data.dismissedSuggestions.keys()]).toEqual(['sam_dismissed']);
  });
});
