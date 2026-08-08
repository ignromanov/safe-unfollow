import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from '@/lib/export/download';

const createObjectURL = vi.fn(() => 'blob:mock-url');
const revokeObjectURL = vi.fn();

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should trigger a download with the given filename', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'accounts.csv');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // Safari aborts an in-flight download if the object URL is revoked in the
  // same tick as the click.
  it('should not revoke the object URL synchronously', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'accounts.csv');

    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should remove the temporary anchor from the document', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'accounts.csv');

    expect(document.querySelector('a[download]')).toBeNull();
  });
});
