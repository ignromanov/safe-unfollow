import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openFeedbackForm, TALLY_FORM_ID } from '@/lib/feedback/tally';

const CTX = { locale: 'en', page: 'results', version: '1.6.0' };

describe('feedback/tally', () => {
  beforeEach(() => {
    document.getElementById('tally-embed-js')?.remove();
    delete (window as { Tally?: unknown }).Tally;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects nothing at import time', () => {
    expect(document.getElementById('tally-embed-js')).toBeNull();
  });

  it('injects the embed script and opens the popup with hidden fields', async () => {
    const openPopup = vi.fn();
    window.Tally = { openPopup };

    // jsdom never fires load/error on injected <script> tags on its own —
    // resolve the injection as soon as the tag appears in the document.
    const promise = openFeedbackForm(CTX);
    document.getElementById('tally-embed-js')?.dispatchEvent(new Event('load'));
    await promise;

    const script = document.getElementById('tally-embed-js') as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.src).toContain('tally.so/widgets/embed.js');

    expect(openPopup).toHaveBeenCalledWith(
      TALLY_FORM_ID,
      expect.objectContaining({ layout: 'modal', width: 500 })
    );
  });

  it('does not inject a second script tag on a second call', async () => {
    const openPopup = vi.fn();
    window.Tally = { openPopup };

    const first = openFeedbackForm(CTX);
    document.getElementById('tally-embed-js')?.dispatchEvent(new Event('load'));
    await first;

    await openFeedbackForm(CTX);

    expect(document.querySelectorAll('#tally-embed-js')).toHaveLength(1);
    expect(openPopup).toHaveBeenCalledTimes(2);
  });

  it('hiddenFields contains exactly locale, page and version', async () => {
    const openPopup = vi.fn();
    window.Tally = { openPopup };

    const promise = openFeedbackForm(CTX);
    document.getElementById('tally-embed-js')?.dispatchEvent(new Event('load'));
    await promise;

    const [, options] = openPopup.mock.calls[0] as [
      string,
      { hiddenFields: Record<string, unknown> },
    ];
    expect(Object.keys(options.hiddenFields).sort()).toEqual(['locale', 'page', 'version']);
    expect(options.hiddenFields).toEqual(CTX);
  });

  it('rejects when the script fails to load', async () => {
    const promise = openFeedbackForm(CTX);
    document.getElementById('tally-embed-js')?.dispatchEvent(new Event('error'));

    await expect(promise).rejects.toThrow();
  });

  it('rejects when Tally.openPopup is unavailable after load', async () => {
    const promise = openFeedbackForm(CTX);
    document.getElementById('tally-embed-js')?.dispatchEvent(new Event('load'));

    await expect(promise).rejects.toThrow();
  });

  it('is a no-op-safe when document is unavailable', async () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error -- simulate an SSG/non-DOM environment
    delete globalThis.document;

    try {
      await expect(openFeedbackForm(CTX)).resolves.toBeUndefined();
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
