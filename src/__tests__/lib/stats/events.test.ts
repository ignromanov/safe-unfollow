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
});
