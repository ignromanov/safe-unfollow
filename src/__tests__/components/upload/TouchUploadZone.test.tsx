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
