import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ads/loader', () => ({ pushAdSlot: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ analytics: { adSlotViewable: vi.fn() } }));

import { UploadAdSlot } from '@/components/upload/UploadAdSlot';

describe('UploadAdSlot', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing, and reserves nothing, while the unit is unconfigured', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
    vi.stubEnv('VITE_ADSENSE_SLOT_UPLOAD', '');

    const { container } = render(<UploadAdSlot />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing without the publisher id, whatever the slot says', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', '');
    vi.stubEnv('VITE_ADSENSE_SLOT_UPLOAD', '444');

    const { container } = render(<UploadAdSlot />);

    expect(container.innerHTML).toBe('');
  });

  it('mounts the AdSense unit for the upload slot inside a reserved box', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
    vi.stubEnv('VITE_ADSENSE_SLOT_UPLOAD', '444');

    const { container } = render(<UploadAdSlot />);

    const reserve = container.querySelector('[data-upload-ad-reserve]') as HTMLElement;
    const unit = reserve.querySelector('[data-ad-name="upload"]') as HTMLElement;
    expect(unit).not.toBeNull();
    // The box held open must cover the unit it holds open for, or the
    // reservation is decoration and the unit still shifts the page.
    const unitBox = unit.querySelector('[style*="min-height"]') as HTMLElement;
    expect(parseInt(reserve.style.minHeight, 10)).toBeGreaterThan(
      parseInt(unitBox.style.minHeight, 10)
    );
  });

  // The prerendered page is a server render: AdSlot is client-only and emits
  // nothing there, so without the reservation the unit would arrive after
  // hydration and push everything below it down by its full height.
  it('carries the reserved height into the prerendered HTML, with no ad in it', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT', 'ca-pub-test');
    vi.stubEnv('VITE_ADSENSE_SLOT_UPLOAD', '444');

    const html = renderToString(<UploadAdSlot />);

    expect(html).toContain('data-upload-ad-reserve');
    expect(html).toMatch(/min-height:\s*312px/);
    expect(html).not.toContain('adsbygoogle');
    expect(html).not.toContain('data-ad-name');
  });
});
