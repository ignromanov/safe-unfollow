import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  forgetExportModal,
  rememberExportModal,
  takeExportResume,
} from '@/lib/export/export-resume';

const saved = { filename: 'safeunfollow-sample.html', total: 1234, capped: true };

describe('export resume', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands back the paywall a reload interrupted, once', () => {
    rememberExportModal({ modal: 'paywall', fileHash: 'h1', saved });

    expect(takeExportResume('h1')).toEqual({ modal: 'paywall', fileHash: 'h1', saved });
    // Once: a second mount in the same tab must not reopen a modal the reader closed.
    expect(takeExportResume('h1')).toBeNull();
  });

  it('hands back the format dialog of an unlocked reader', () => {
    rememberExportModal({ modal: 'export', fileHash: 'h1' });

    expect(takeExportResume('h1')).toEqual({ modal: 'export', fileHash: 'h1' });
  });

  it('leaves nothing to resume once the modal has mounted', () => {
    rememberExportModal({ modal: 'export', fileHash: 'h1' });
    forgetExportModal();

    expect(takeExportResume('h1')).toBeNull();
  });

  // The results page can mount before its file is known, and a reader can load a
  // different export in the same tab. Neither may consume, or be offered, another
  // file's receipt.
  it('does not hand one file’s intent to another, and keeps it for the right one', () => {
    rememberExportModal({ modal: 'paywall', fileHash: 'h1', saved });

    expect(takeExportResume('h2')).toBeNull();
    expect(takeExportResume('h1')).not.toBeNull();
  });

  it.each([
    ['not JSON', '{'],
    ['an unknown modal', JSON.stringify({ modal: 'license', fileHash: 'h1' })],
    ['a paywall without its receipt', JSON.stringify({ modal: 'paywall', fileHash: 'h1' })],
    [
      'a receipt with a non-numeric total',
      JSON.stringify({ modal: 'paywall', fileHash: 'h1', saved: { ...saved, total: '1234' } }),
    ],
  ])('ignores %s', (_label, raw) => {
    sessionStorage.setItem('export-resume', raw);

    expect(takeExportResume('h1')).toBeNull();
  });

  // Replaced wholesale: jsdom's Storage does not dispatch through Storage.prototype, so a
  // prototype spy intercepts nothing and this test would pass against real storage.
  it('degrades to "nothing to resume" when storage refuses', () => {
    const real = window.sessionStorage;
    const refuse = (): never => {
      throw new DOMException('denied', 'SecurityError');
    };
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: refuse, setItem: refuse, removeItem: refuse },
    });
    try {
      expect(() => rememberExportModal({ modal: 'export', fileHash: 'h1' })).not.toThrow();
      expect(() => forgetExportModal()).not.toThrow();
      expect(takeExportResume('h1')).toBeNull();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: real });
    }
  });
});
