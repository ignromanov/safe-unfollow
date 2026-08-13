import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { analytics } from '@/lib/analytics';
import { INVENTED_LABELS, labelValuesEntry } from '../fixtures/instagram-format-drift';

/**
 * GH#21 Task 5. `usernameLabelResolution` carries only the resolution mode —
 * never the label string, which is Meta's UI text in the export's own
 * language and would leak that language. This is the test that proves it at
 * the boundary that matters: what `window.umami.track` actually receives,
 * not the in-memory object. See `exportFormatDriftEndToEnd.test.ts`'s
 * file-level docblock for why a real `jszip` (not the `__mocks__/jszip.cjs`
 * double) and a `Uint8Array` cast are used here too.
 *
 * The analytics module is deliberately NOT mocked in this file — everywhere
 * else that touches `usernameLabelResolution` (`useFileUpload.test.ts`)
 * mocks `@/lib/analytics` entirely, which proves the call happened but not
 * what it serialises to. This file mocks one layer lower, `window.umami`,
 * so the assertion is against the real payload object `trackEvent` builds.
 */

const BASE_PATH = 'connections/followers_and_following';

// Invented, not a real Instagram handle — this repository is public and
// `raw/` (real exports) must never leak into a fixture or this file.
const ARCHIVE_USERNAME = 'sample_user_zz9x';
// The invented-language label from the shared fixture set — not English, so
// a leak here could also be read as an export-locale leak (see events.ts
// docblock on `usernameLabelResolution`).
const RESOLVED_LABEL = INVENTED_LABELS.username;

async function buildZip(files: Record<string, unknown>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, payload] of Object.entries(files)) {
    zip.file(`${BASE_PATH}/${name}`, JSON.stringify(payload));
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('usernameLabelResolution telemetry does not leak archive contents', () => {
  let trackMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackMock = vi.fn();
    // Minimal stand-in for `window` — `trackEvent` only reads `window.umami`.
    (global as unknown as { window: unknown }).window = { umami: { track: trackMock } };
    vi.stubEnv('DEV', false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('never puts the resolved username or label string on the wire', async () => {
    const bytes = await buildZip({
      // A single label_values entry with no other close-friends record to
      // pool against — the archive-wide scorer still resolves it (unlike the
      // ambiguous two-label case in instagram-labels.test.ts) because the
      // display name and URL default values are not username-shaped, so
      // this exercises the ordinary `inferred` path, not `fast-path`.
      'close_friends.json': [labelValuesEntry(ARCHIVE_USERNAME, { labels: INVENTED_LABELS })],
    });
    const result = await parseInstagramZipFile(bytes as unknown as File);

    expect(result.labelResolutionMode).toBe('inferred');
    expect(result.data.closeFriends.has(ARCHIVE_USERNAME)).toBe(true);

    analytics.usernameLabelResolution(result.labelResolutionMode);

    expect(trackMock).toHaveBeenCalledTimes(1);
    const [, payload] = trackMock.mock.calls[0]!;
    const serialised = JSON.stringify(payload);

    // Assert on the serialised form, not the object: the point is what
    // actually leaves the browser, and a mutation adding a field to the
    // object without including it in this string would not be caught by an
    // object-shape assertion the way it is caught here.
    expect(serialised).toBe(JSON.stringify({ mode: 'inferred' }));
    expect(serialised).not.toContain(ARCHIVE_USERNAME);
    expect(serialised).not.toContain(RESOLVED_LABEL);
  });
});
