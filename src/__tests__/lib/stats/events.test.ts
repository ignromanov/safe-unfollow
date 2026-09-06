import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
const trackEvent = vi.fn();
const trackNavigating = vi.fn();
const flushEvents = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: (name: string, data?: unknown) => trackNavigating(name, data),
  flushEvents: () => flushEvents(),
}));
vi.mock('@/lib/stats/core', () => ({
  trackEvent: (name: string, data?: unknown) => trackEvent(name, data),
}));

import { analytics } from '@/lib/stats/events';

/**
 * `uploadErrorByCode` had no test of its own until the file size was added to
 * it — it was exercised only through `useFileUpload.test.ts`, which asserts
 * that it was called and with which code, never what the payload contains.
 * That is how a field can be added to an event and nothing notices its shape.
 */
describe('uploadErrorByCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries the file size as a number, not buried in translated prose', () => {
    analytics.uploadErrorByCode('CORRUPTED_ZIP', 'boom', 863.42);

    expect(enqueueEvent).toHaveBeenCalledWith(
      'upload_error_corrupted_zip',
      expect.objectContaining({ file_size_mb: 863.42 })
    );
  });

  it('rounds the size exactly as fileUploadStart does, so the two cannot disagree', () => {
    analytics.uploadErrorByCode('CORRUPTED_ZIP', 'boom', 863.4267578125);
    analytics.fileUploadStart(863.4267578125);

    const [, errorPayload] = enqueueEvent.mock.calls[0];
    const [, startPayload] = enqueueEvent.mock.calls[1];
    expect(errorPayload.file_size_mb).toBe(startPayload.file_size_mb);
  });

  // The refusal, pinned. `file_hash` rode on all ten upload_error events until
  // 2026-08-21: 12 hex characters derived from the user's own Instagram export,
  // stable across sessions, read by no report. A field a product deliberately
  // refuses needs a test as much as a field it deliberately sends, or the next
  // author reads its absence as an oversight.
  it('sends nothing derived from the export itself', () => {
    analytics.uploadErrorByCode('CORRUPTED_ZIP', 'boom', 863.42);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('file_hash');
    expect(payload).not.toHaveProperty('file_hash_prefix');
  });

  it('omits the size when the failure happened before a file was known', () => {
    analytics.uploadErrorByCode('UPLOAD_CANCELLED', undefined, undefined);

    // Absent and zero must not be the same thing: a 0 would be a real-looking
    // value in a column decisions get made from.
    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('file_size_mb');
  });

  // GH#156 — after PR #152 an HTML markup drift and a JSON schema drift raise
  // the same error series with nothing to tell the two populations apart.
  it('carries the export format an HTML failure was discovered in', () => {
    analytics.uploadErrorByCode('INVALID_DATA_STRUCTURE', 'boom', 12, 'html');

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toMatchObject({ format: 'html' });
  });

  it('carries json the same way, so the two populations are comparable', () => {
    analytics.uploadErrorByCode('INVALID_DATA_STRUCTURE', 'boom', 12, 'json');

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toMatchObject({ format: 'json' });
  });

  it('omits format rather than fabricating one when nothing was discovered yet', () => {
    analytics.uploadErrorByCode('NOT_ZIP', 'not a zip', 1.5);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('format');
  });
});

describe('fileUploadSuccess format field (GH#156)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries the format of a freshly parsed export', () => {
    analytics.fileUploadSuccess(100, false, 'html');

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toMatchObject({ format: 'html' });
  });

  it('omits format on the cache-hit path — nothing was parsed this call', () => {
    analytics.fileUploadSuccess(100, true);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('format');
  });
});

describe('fileUploadSuccess mixed_relationship_formats field (GH#160)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a half-merged archive', () => {
    analytics.fileUploadSuccess(100, false, 'json', true);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toMatchObject({ mixed_relationship_formats: true });
  });

  it('reports a clean archive as false rather than omitting it', () => {
    // `false` has to travel. The rate this field exists to measure is
    // `mixed / observed`, and a field sent only when true has no denominator —
    // absence would mean both "clean" and "never looked".
    analytics.fileUploadSuccess(100, false, 'json', false);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toMatchObject({ mixed_relationship_formats: false });
  });

  it('omits it on the cache-hit path, where no archive was analysed', () => {
    analytics.fileUploadSuccess(100, true);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('mixed_relationship_formats');
  });
});

describe('optionalFileFormatDrift format field (GH#156)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries the export format the drift was found in', () => {
    analytics.optionalFileFormatDrift('INVALID_UNFOLLOWED_FORMAT', 'html');

    expect(trackEvent).toHaveBeenCalledWith('optional_file_format_drift', {
      file_code: 'INVALID_UNFOLLOWED_FORMAT',
      format: 'html',
    });
  });

  it('omits format when the caller has none to give', () => {
    analytics.optionalFileFormatDrift('INVALID_UNFOLLOWED_FORMAT');

    expect(trackEvent).toHaveBeenCalledWith('optional_file_format_drift', {
      file_code: 'INVALID_UNFOLLOWED_FORMAT',
    });
  });
});

describe('relationshipSkewVerdict format field (GH#156)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries the export format the verdict was reached on', () => {
    analytics.relationshipSkewVerdict('insufficient-data', 'html');

    expect(trackEvent).toHaveBeenCalledWith('relationship_skew_verdict', {
      verdict: 'insufficient-data',
      format: 'html',
    });
  });

  it('omits format when the caller has none to give', () => {
    analytics.relationshipSkewVerdict('no-skew');

    expect(trackEvent).toHaveBeenCalledWith('relationship_skew_verdict', {
      verdict: 'no-skew',
    });
  });
});

/**
 * GH#156, the blocked half. `insufficient-data` has at least three causes and
 * only `dates_fitted: false` names the locale-driven one — a real date that a
 * fitted month table still could not read, as opposed to too few timestamps
 * or rows that never matched the date shape at all.
 */
describe('relationshipSkewVerdict dates_fitted field (GH#156)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries dates_fitted false when a required file could not date itself', () => {
    analytics.relationshipSkewVerdict('insufficient-data', 'html', false);

    expect(trackEvent).toHaveBeenCalledWith('relationship_skew_verdict', {
      verdict: 'insufficient-data',
      format: 'html',
      dates_fitted: false,
    });
  });

  it('carries dates_fitted true on a clean HTML parse, so the field has a denominator', () => {
    analytics.relationshipSkewVerdict('no-skew', 'html', true);

    expect(trackEvent).toHaveBeenCalledWith('relationship_skew_verdict', {
      verdict: 'no-skew',
      format: 'html',
      dates_fitted: true,
    });
  });

  it('omits dates_fitted for a JSON export rather than fabricating a value', () => {
    analytics.relationshipSkewVerdict('insufficient-data', 'json');

    const [, payload] = trackEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('dates_fitted');
  });
});

/**
 * The per-toggle event is gone: `filter_toggle` was 31 520 event rows and
 * 94 560 payload rows, and one `filter_session_summary` per session carries the
 * same four findings. What this block used to guard — that a toggle records
 * WHICH surface produced it, the blind spot that hid 2 377 stat-card mutations
 * across 990 sessions — now lives as `source_mix` on the summary, gated in
 * `src/__tests__/components/FilterChips.test.tsx` and
 * `src/__tests__/components/AccountListSection.test.tsx`.
 */
