import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

import { TouchUploadZone } from '@/components/upload/TouchUploadZone';

function renderZone(isProcessing: boolean) {
  return render(
    <TouchUploadZone
      fileInputRef={createRef<HTMLInputElement>()}
      isProcessing={isProcessing}
      onFileInput={vi.fn()}
    />
  );
}

describe('TouchUploadZone', () => {
  it('invites a tap while idle', () => {
    const { container } = renderZone(false);

    const label = container.querySelector('label') as HTMLElement;
    expect(label).toHaveTextContent(uploadEN.zone.tapToSelect);
    expect(label).not.toHaveAttribute('aria-busy', 'true');
  });

  it('carries the parse state on the button itself, not beside it', () => {
    const { container } = renderZone(true);

    // The status used to be a caption under the button while the button kept
    // saying "tap to select" — two contradictory affordances at once. The
    // control that started the work is the one that has to report it.
    const label = container.querySelector('label') as HTMLElement;
    expect(label).toHaveAttribute('aria-busy', 'true');
    expect(label.textContent?.trim()).toBe(uploadEN.zone.processing);
    // Nothing outside the button reports the state: the container's entire
    // text is the button's own label.
    expect(container.textContent?.trim()).toBe(uploadEN.zone.processing);
  });

  describe('under a page translator', () => {
    // Chrome's built-in translator replaces every text node it translates with
    // <font><font>…</font></font>. React still holds the original node, so any
    // insertBefore/removeChild that uses it as a reference throws NotFoundError
    // and the ErrorBoundary takes the page. Measured 2026-10-30 → 11-16: 122
    // error_boundary events in 83 sessions, every one Chrome/Android on /upload,
    // every stack ending in this label — at the moment the reader picks a file.
    function translateTextNodes(root: Element): void {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        if (!node.nodeValue?.trim()) continue;
        const outer = document.createElement('font');
        const inner = document.createElement('font');
        inner.textContent = `[translated] ${node.nodeValue}`;
        outer.appendChild(inner);
        node.replaceWith(outer);
      }
    }

    function renderWithTranslator(from: boolean, to: boolean) {
      const props = { fileInputRef: createRef<HTMLInputElement>(), onFileInput: vi.fn() };
      const view = render(<TouchUploadZone {...props} isProcessing={from} />);
      translateTextNodes(view.container);
      return () => view.rerender(<TouchUploadZone {...props} isProcessing={to} />);
    }

    it('survives the switch to the busy state when the file is picked', () => {
      expect(renderWithTranslator(false, true)).not.toThrow();
    });

    it('survives the switch back to idle when the parse ends', () => {
      expect(renderWithTranslator(true, false)).not.toThrow();
    });
  });

  it('holds its height across the state change so nothing below it moves', () => {
    // The busy label is one line where the idle label is two in the long
    // locales; without a floor the button would shrink at parse start and drag
    // the offer below it up by ~28px.
    const idle = renderZone(false).container.querySelector('label') as HTMLElement;
    expect(idle.className).toMatch(/min-h-/);

    const busy = renderZone(true).container.querySelector('label') as HTMLElement;
    expect(busy.className).toMatch(/min-h-/);
  });
});
