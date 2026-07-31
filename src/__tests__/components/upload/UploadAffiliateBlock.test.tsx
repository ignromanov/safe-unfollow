import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const affiliateBlockClick = vi.fn();
vi.mock('@/lib/stats', () => ({
  analytics: { affiliateBlockClick: (id: string) => affiliateBlockClick(id) },
}));

const mockLanguage = vi.fn(() => 'en');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockLanguage() },
  }),
}));

import { UploadAffiliateBlock } from '@/components/upload/UploadAffiliateBlock';

describe('UploadAffiliateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage.mockReturnValue('en');
  });

  it('links out to the resolved offer in a new tab, safely', () => {
    render(<UploadAffiliateBlock />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('offer_id=15'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('routes a ru visitor to the offer their country is in', () => {
    mockLanguage.mockReturnValue('ru');

    render(<UploadAffiliateBlock />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('offer_id=153')
    );
  });

  it('shows the affiliate disclosure next to the link, not buried', () => {
    render(<UploadAffiliateBlock />);

    expect(screen.getByText('affiliate.disclosure')).toBeInTheDocument();
  });

  it('leads with our line, then the banner, when the offer has a creative', () => {
    const { container } = render(<UploadAffiliateBlock />);

    // Queried by tag, not by role: a decorative `alt=""` image is removed from
    // the a11y tree, so there is no role for Testing Library to find.
    const img = container.querySelector('img') as HTMLImageElement;
    const lead = screen.getByText('affiliate.nordvpn.title');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/affiliate/nordvpn-300x250.webp');
    // Intrinsic size present so the banner cannot shift layout as it decodes.
    expect(img.getAttribute('width')).toBe('300');
    expect(img.getAttribute('height')).toBe('250');
    // Our line above their ad, never beside it.
    expect(lead.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops our body copy when the banner is present, so there is one pitch not two', () => {
    // The creative is a finished ad with its own headline and its own CTA.
    // Rendering our description alongside it puts two pitches in one clickable
    // box and the eye has to choose.
    render(<UploadAffiliateBlock />);

    expect(screen.queryByText('affiliate.nordvpn.desc')).not.toBeInTheDocument();
  });

  it('renders the banner at every width — no breakpoint may suppress it', () => {
    // 81% of traffic is mobile. A banner hidden below `sm` is 10 KB downloaded
    // to render a gap.
    const { container } = render(<UploadAffiliateBlock />);

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.className).not.toMatch(/\bhidden\b/);
  });

  it('falls back to the text-only card for an offer with no creative', () => {
    // Offer 226 has none attached, and a required banner would couple the block
    // to a single offer.
    mockLanguage.mockReturnValue('ar');

    const { container } = render(<UploadAffiliateBlock />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('affiliate.nordvpn.title')).toBeInTheDocument();
    // Without a banner our own copy has to carry the pitch.
    expect(screen.getByText('affiliate.nordvpn.desc')).toBeInTheDocument();
  });

  it('reports the click with the offer id, so the network row can be matched', async () => {
    const user = userEvent.setup();
    render(<UploadAffiliateBlock />);

    await user.click(screen.getByRole('link'));

    expect(affiliateBlockClick).toHaveBeenCalledWith('nordvpn_global');
  });

  it('renders nothing when the offer is switched off', async () => {
    vi.doMock('@/config/affiliate-offers', () => ({ resolveAffiliateOffer: () => null }));
    vi.resetModules();

    const { UploadAffiliateBlock: Reloaded } =
      await import('@/components/upload/UploadAffiliateBlock');
    const { container } = render(<Reloaded />);

    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('@/config/affiliate-offers');
  });
});
