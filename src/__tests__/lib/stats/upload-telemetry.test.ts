import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
const trackEvent = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: vi.fn(),
  flushEvents: vi.fn(),
}));
vi.mock('@/lib/indexeddb/indexeddb-service');
vi.mock('@/lib/stats/core', () => ({
  trackEvent: (name: string, data?: unknown) => trackEvent(name, data),
  trackBeacon: vi.fn(),
}));

import type { BadgeKey, FileExpectation } from '@/core/types';
import { FILE_SPECS, PERMANENT_REQUESTS_SPEC } from '@/core/parsers/instagram-file-specs';
import { analytics } from '@/lib/stats/events';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { parseWithWorker } from '@/lib/parse-orchestration';
import {
  BADGE_SOURCE_FILES,
  measuredBadgeCounts,
  readBadgeCounts,
} from '@/lib/stats/upload-badge-counts';
import { newUploadId, withUpload } from '@/lib/stats/upload-context';

/** Every payload any transport received, in call order. */
function payloads(): Record<string, unknown>[] {
  return [...enqueueEvent.mock.calls, ...trackEvent.mock.calls].map(
    ([, data]) => (data ?? {}) as Record<string, unknown>
  );
}

/** Fire every emitter that belongs to one upload attempt. */
function emitOneAttempt(): void {
  analytics.fileUploadStart(1);
  analytics.optionalFileFormatDrift('INVALID_PENDING_FORMAT', 'json');
  analytics.usernameLabelResolution('fast-path');
  analytics.relationshipSkewVerdict('followers', 'json');
  analytics.relationshipFileTruncated('followers');
  analytics.fileUploadSuccess(10, false, 'json');
  analytics.uploadErrorByCode('CORRUPTED_ZIP', 'boom', 1);
  analytics.uploadParseDuration(1200, 'success');
}

describe('upload_id: one key for one upload attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('puts the same id on every event of one attempt', () => {
    withUpload(newUploadId(), emitOneAttempt);

    const ids = payloads().map(p => p.upload_id);
    expect(ids).toHaveLength(8);
    expect(ids[0]).toEqual(expect.stringMatching(/^[a-z0-9]+$/));
    expect(new Set(ids).size).toBe(1);
  });

  it('gives the next attempt a different id', () => {
    withUpload(newUploadId(), () => analytics.fileUploadStart(1));
    withUpload(newUploadId(), () => analytics.fileUploadStart(1));

    const [a, b] = payloads().map(p => p.upload_id);
    expect(a).toEqual(expect.any(String));
    expect(a).not.toBe(b);
  });

  it('keeps two overlapping attempts apart', () => {
    // Attempt 2 starts while attempt 1 is still parsing; attempt 1 then fails.
    const first = newUploadId();
    const second = newUploadId();
    withUpload(first, () => analytics.fileUploadStart(1));
    withUpload(second, () => {
      analytics.fileUploadStart(1);
    });
    withUpload(first, () => analytics.uploadErrorByCode('UPLOAD_CANCELLED'));

    expect(payloads().map(p => p.upload_id)).toEqual([first, second, first]);
  });

  it('is absent, not empty, outside an attempt', () => {
    withUpload(newUploadId(), () => {});
    emitOneAttempt();

    for (const payload of payloads()) expect(payload).not.toHaveProperty('upload_id');
  });

  it('stays off events that are not part of an upload', () => {
    // The control: the id must not leak onto the rest of the session.
    withUpload(newUploadId(), () => analytics.searchPerform(3, 0, 100, false));

    expect(payloads()[0]).not.toHaveProperty('upload_id');
  });
});

function file(name: string, found: boolean, formatUnreadable = false): FileExpectation {
  return { name, description: '', required: false, found, formatUnreadable };
}

const ALL: Record<BadgeKey, number> = {
  following: 400,
  followers: 380,
  pending: 3,
  permanent: 0,
  restricted: 1,
  close: 0,
  unfollowed: 25,
  dismissed: 7,
  notFollowingBack: 60,
  notFollowedBack: 40,
  mutuals: 340,
};

function everyFile(): FileExpectation[] {
  return [...FILE_SPECS, PERMANENT_REQUESTS_SPEC].map(spec => file(spec.name, true));
}

describe('measuredBadgeCounts', () => {
  it('sends a flat count for every badge whose source files were read', () => {
    expect(measuredBadgeCounts(ALL, everyFile())).toEqual({
      count_following: 400,
      count_followers: 380,
      count_pending: 3,
      count_permanent: 0,
      count_restricted: 1,
      count_close: 0,
      count_unfollowed: 25,
      count_dismissed: 7,
      count_not_following_back: 60,
      count_not_followed_back: 40,
      count_mutuals: 340,
    });
  });

  it('omits a badge whose file was not in the download, rather than sending 0', () => {
    // The GH#34 question: how many exports carry the unfollowed file at all.
    // `getBadgeStats` answers 0 for "absent" and "present and empty" alike.
    const files = everyFile().map(f =>
      f.name === 'recently_unfollowed.json' ? file(f.name, false) : f
    );

    const counts = measuredBadgeCounts({ ...ALL, unfollowed: 0 }, files);
    expect(counts).not.toHaveProperty('count_unfollowed');
    expect(counts.count_close).toBe(0); // present and empty still travels
  });

  it('omits a badge whose file was found but could not be read', () => {
    const files = everyFile().map(f =>
      f.name === 'pending_follow_requests.json' ? file(f.name, true, true) : f
    );

    expect(measuredBadgeCounts(ALL, files)).not.toHaveProperty('count_pending');
  });

  it('omits the derived badges when either relationship file is missing', () => {
    const files = everyFile().map(f => (f.name === 'followers_*.json' ? file(f.name, false) : f));

    const counts = measuredBadgeCounts(ALL, files);
    expect(counts).not.toHaveProperty('count_followers');
    expect(counts).not.toHaveProperty('count_mutuals');
    expect(counts).not.toHaveProperty('count_not_following_back');
    expect(counts).not.toHaveProperty('count_not_followed_back');
    expect(counts.count_following).toBe(400);
  });

  it('omits a badge the store has no number for', () => {
    const { dismissed: _dropped, ...rest } = ALL;
    expect(measuredBadgeCounts(rest, everyFile())).not.toHaveProperty('count_dismissed');
  });

  it('names only files the parser actually expects', () => {
    // A renamed spec would otherwise silently drop its badge from every row.
    const known = new Set([...FILE_SPECS, PERMANENT_REQUESTS_SPEC].map(spec => spec.name));
    for (const names of Object.values(BADGE_SOURCE_FILES)) {
      for (const name of names) expect(known).toContain(name);
    }
  });
});

describe('fileUploadSuccess with badge counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spreads the counts into the payload as flat keys', () => {
    analytics.fileUploadSuccess(10, false, 'json', undefined, undefined, {
      count_following: 4,
      count_unfollowed: 0,
    });

    expect(enqueueEvent).toHaveBeenCalledWith(
      'file_upload_success',
      expect.objectContaining({ count_following: 4, count_unfollowed: 0 })
    );
  });
});

describe('readBadgeCounts', () => {
  it('reads the stored counts for the hash and keeps only the measured ones', async () => {
    vi.mocked(indexedDBService.getBadgeStats).mockResolvedValue(ALL);
    const files = everyFile().map(f =>
      f.name === 'recently_unfollowed.json' ? file(f.name, false) : f
    );

    const counts = await readBadgeCounts('hash-1', files);

    expect(indexedDBService.getBadgeStats).toHaveBeenCalledWith('hash-1');
    expect(counts.count_following).toBe(400);
    expect(counts).not.toHaveProperty('count_unfollowed');
  });

  it('sends no counts when the store cannot be read, rather than failing', async () => {
    vi.mocked(indexedDBService.getBadgeStats).mockRejectedValue(new Error('gone'));

    await expect(readBadgeCounts('hash-1', everyFile())).resolves.toEqual({});
  });
});

describe("parseWithWorker forwards the worker's badge counts", () => {
  it('hands badgeCounts from the result message to the caller', async () => {
    const listeners: ((e: MessageEvent) => void)[] = [];
    const worker = {
      addEventListener: (_type: string, fn: (e: MessageEvent) => void) => listeners.push(fn),
      removeEventListener: vi.fn(),
      postMessage: () => {
        for (const fn of listeners) {
          fn({
            data: {
              type: 'result',
              fileHash: 'h',
              accountCount: 3,
              badgeCounts: { count_following: 3 },
            },
          } as MessageEvent);
        }
      },
    } as unknown as Worker;

    const result = await parseWithWorker(worker, new File(['x'], 'a.zip'), 'h', () => {});

    expect(result.badgeCounts).toEqual({ count_following: 3 });
  });
});
