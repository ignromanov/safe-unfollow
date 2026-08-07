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

    // Matched on the whole URL, not a fragment. The links are short codes now
    // (`/SHAow`), so there is no `offer_id=` left in them to key on and no
    // substring short enough to be safe — `SHAow` and `SHBsa` differ by two
    // characters, and a `stringContaining` on either would be one typo away
    // from passing for the wrong offer.
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://go.nordvpn.net/SHAow');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('routes a ru visitor to the offer their country is in', () => {
    mockLanguage.mockReturnValue('ru');

    render(<UploadAffiliateBlock />);

    // Offer 153 — Belarus, China, Russia. Served over https even though the
    // network lists it as http: a cleartext hop would undercut the one claim
    // this placement makes.
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://get.affiliatescn.net/SHBvA');
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
    expect(img.getAttribute('src')).toBe('/affiliate/nordvpn-v2-300x250.webp');
    // Intrinsic size present so the banner cannot shift layout as it decodes.
    expect(img.getAttribute('width')).toBe('300');
    expect(img.getAttribute('height')).toBe('250');
    // Our line above their ad, never beside it.
    expect(lead.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the wide cut from lg up, carrying its own intrinsic size', () => {
    // The upload column is roughly 750px from `lg`; the 300px base cut fills
    // under half of it. The size attributes matter as much as the source: they
    // are what reserves the wide box instead of the base 6:5 one, and jsdom
    // will never catch a wrong pair by rendering it.
    const { container } = render(<UploadAffiliateBlock />);

    const source = container.querySelector('picture > source') as HTMLSourceElement;
    expect(source).not.toBeNull();
    expect(source.getAttribute('media')).toBe('(min-width: 1024px)');
    expect(source.getAttribute('srcset')).toBe('/affiliate/nordvpn-v2-970x250.webp');
    expect(source.getAttribute('width')).toBe('970');
    expect(source.getAttribute('height')).toBe('250');
  });

  it('keeps the wide cut ahead of the fallback img, or the browser never sees it', () => {
    // `<picture>` takes the first matching child. An `<img>` placed above the
    // `<source>` wins unconditionally and the desktop cut becomes dead weight
    // in the repo — downloaded by nobody, noticed by nobody.
    const { container } = render(<UploadAffiliateBlock />);

    const source = container.querySelector('picture > source') as HTMLSourceElement;
    const img = container.querySelector('picture > img') as HTMLImageElement;
    expect(source.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('falls back to the text-only card for an offer with no creative', async () => {
    // No live offer takes this branch any more — all three borrow the one
    // creative we hold. The branch stays because `creative` is optional and
    // that borrowing is unconfirmed with the network: if it has to be undone,
    // this path carries the placement, and an untested path would carry it
    // badly. Stub an offer rather than pick a language, so the test keeps
    // testing the branch instead of quietly testing nothing the day a locale
    // gains a banner.
    vi.doMock('@/config/affiliate-offers', () => ({
      resolveAffiliateOffer: () => ({
        id: 'stub_no_creative',
        copyKey: 'nordvpn',
        url: 'https://example.test/aff_c?offer_id=999',
      }),
    }));
    vi.resetModules();

    const { UploadAffiliateBlock: Reloaded } =
      await import('@/components/upload/UploadAffiliateBlock');
    const { container } = render(<Reloaded />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('picture')).toBeNull();
    expect(screen.getByText('affiliate.nordvpn.title')).toBeInTheDocument();
    // Without a banner our own copy has to carry the pitch.
    expect(screen.getByText('affiliate.nordvpn.desc')).toBeInTheDocument();

    vi.doUnmock('@/config/affiliate-offers');
    vi.resetModules();
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
