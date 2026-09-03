import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import commonEN from '@/locales/en/common.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(commonEN));

import { PrivacyPolicy } from '@/components/PrivacyPolicy';

describe('PrivacyPolicy Component', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should render the main heading', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(
        screen.getByRole('heading', { level: 1, name: /privacy policy/i })
      ).toBeInTheDocument();
    });

    it('should render the last updated date', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/last updated: august 8, 2026/i)).toBeInTheDocument();
    });
  });

  describe('privacy policy content', () => {
    it('should render the TL;DR summary section', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/TL;DR — Privacy Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/100% Local Processing/i)).toBeInTheDocument();
      expect(screen.getByText(/No Account Required/i)).toBeInTheDocument();
      expect(screen.getByText(/Optional Analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/Ads Keep This Free/i)).toBeInTheDocument();
    });

    // The app serves AdSense units (see components/ads/AdSlot). Shipping ads
    // without this disclosure would make the policy false, so it is a test and
    // not a convention.
    it('should disclose advertising and that ads cannot use Instagram data', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/5\.4 Advertising \(Google AdSense\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Ads are never targeted using your Instagram data/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/consent management platform/i)).toBeInTheDocument();
    });

    // Google's Auto ads have served since 2026-08-18 and follow the reader off
    // the routes that declare an `<ins>`, because `adsbygoogle.js` is injected
    // once and survives client-side navigation (lib/ads/loader.ts). §5.4 used
    // to say there were no units on the upload screen; literally true of what
    // we declare, false about what the reader sees, and the database held
    // `/upload#google_vignette` while it said so. The claim is therefore about
    // the mechanism — what we place versus what Google places — because an
    // inventory sentence goes stale the next time somebody opens a console we
    // do not own.
    it('should say Google places ads we do not choose, rather than listing where ads appear', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/placements of its own choosing/i)).toBeInTheDocument();
      expect(
        screen.getByText(/We do not select those and cannot list them here/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/there are none on the upload\s+screen/i)).not.toBeInTheDocument();
    });

    // The one absolute left in §5.4, and it is narrower than it reads: nothing
    // starts the ad script on /sample (AdSlot is the sole injector and refuses
    // there), but nothing unloads it either, so a reader arriving from
    // /results in the same visit carries a live script onto that page. The
    // sentence must survive a reader who checks it by pressing Back.
    it('should qualify the sample-page promise instead of stating it absolutely', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(
        screen.getByText(/never start Google's ad script on the sample-data page/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/can follow you to any screen/i)).toBeInTheDocument();
    });

    // Pro Export sends the buyer to a payment processor and calls its license
    // API from the browser (see lib/export/license.ts). §5.2 had no guard while
    // §5.3 and §5.4 did, which is how the whole section could be rewritten from
    // one processor to another with the suite staying green. The two facts
    // pinned here are the ones a reader cannot verify for themselves: which
    // company receives the payment, and which host receives the license key.
    it('should name the payment processor and the license host it contacts', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/5\.2 Payments \(Dodo Payments\)/i)).toBeInTheDocument();
      expect(screen.getByText(/live\.dodopayments\.com/i)).toBeInTheDocument();
    });

    // The return URL carries the buyer's email address. We strip it on the
    // first render, but it is in the request our host logs before any of our
    // code runs — a limit we cannot engineer away and therefore must state.
    it('should disclose that the checkout return URL carries the buyer email', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/email address you used at checkout/i)).toBeInTheDocument();
      expect(screen.getByText(/hosting provider's short-term request log/i)).toBeInTheDocument();
    });

    // The upload screen carries a persistent affiliate block (see
    // components/upload/UploadAffiliateBlock). The claim that matters is the
    // timing one — nothing reaches the partner until a click — because it is
    // what makes a paid placement compatible with this product's promise. Same
    // reasoning as the AdSense disclosure above: a test, not a convention.
    it('should disclose affiliate links and that partners are not contacted before a click', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/5\.5 Affiliate Links/i)).toBeInTheDocument();
      expect(screen.getByText(/Nothing is sent to a partner until you click/i)).toBeInTheDocument();
      expect(screen.getByText(/served from our own\s+domain/i)).toBeInTheDocument();
    });

    // The results screen carries a Tally feedback link (see
    // lib/feedback/tally.ts). Two claims matter here: the timing one — same
    // shape as the AdSense and affiliate disclosures above, nothing reaches
    // Tally until the form is opened — and the Turnstile one, because a
    // processor that receives an identifier (the opener's IP) is named or it
    // is not.
    it('should disclose the Tally feedback form and Turnstile bot-check processing', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/5\.6 Feedback Form \(Tally\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Nothing reaches Tally until the form is opened/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Cloudflare Turnstile/i)).toBeInTheDocument();
      expect(screen.getByText(/processes the opener's IP address/i)).toBeInTheDocument();
    });

    it('should render all main sections', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/1\. Data We Process Locally/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Data We Collect/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Data We Do NOT Collect/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. How Your Data is Protected/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Third-Party Services/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. Children's Privacy/i)).toBeInTheDocument();
      expect(screen.getByText(/7\. Your Rights/i)).toBeInTheDocument();
      expect(screen.getByText(/8\. Changes to This Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/9\. Contact Us/i)).toBeInTheDocument();
    });

    it('should render the Privacy by Design trust badge', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByText(/Privacy by Design/i)).toBeInTheDocument();
      expect(
        screen.getByText(/We built SafeUnfollow with privacy as the foundation/i)
      ).toBeInTheDocument();
    });

    it('should render the contact email', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      const emailLink = screen.getByRole('link', { name: /privacy@safeunfollow\.app/i });
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@safeunfollow.app');
    });

    it('should render the GitHub link', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      const githubLink = screen.getByRole('link', { name: /github/i });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/ignromanov/safe-unfollow');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render the Vercel privacy policy link', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      const vercelLink = screen.getByRole('link', { name: /vercel's privacy policy/i });
      expect(vercelLink).toBeInTheDocument();
      expect(vercelLink).toHaveAttribute('href', 'https://vercel.com/legal/privacy-policy');
      expect(vercelLink).toHaveAttribute('target', '_blank');
    });
  });

  // The duplicate 5.3 (External Links / Advertising) survived because nothing
  // parsed the headings and checked them against the "see section 5.x"
  // cross-references scattered through the rest of the document. These two
  // tests make that invariant visible instead of relying on someone noticing.
  describe('section 5 numbering', () => {
    it('should have unique, contiguous 5.x subsection numbers starting at 5.1', () => {
      const { container } = render(<PrivacyPolicy onBack={mockOnBack} />);

      const h3Headings = Array.from(container.querySelectorAll('h3'));
      const numbers = h3Headings
        .map(heading => heading.textContent?.match(/^5\.(\d+)\s/)?.[1])
        .filter((n): n is string => n !== undefined)
        .map(Number);

      expect(numbers.length).toBeGreaterThan(0);

      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);

      const sorted = [...uniqueNumbers].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: sorted.length }, (_, i) => i + 1));
    });

    it('should only cross-reference 5.x subsection numbers that exist as headings', () => {
      const { container } = render(<PrivacyPolicy onBack={mockOnBack} />);

      const h3Headings = Array.from(container.querySelectorAll('h3'));
      const headingNumbers = new Set(
        h3Headings
          .map(heading => heading.textContent?.match(/^5\.(\d+)\s/)?.[1])
          .filter((n): n is string => n !== undefined)
          .map(Number)
      );

      const bodyText = container.textContent ?? '';
      const references = [...bodyText.matchAll(/section 5\.(\d+)/g)].map(m => Number(m[1]));

      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) {
        expect(headingNumbers.has(reference)).toBe(true);
      }
    });
  });

  describe('back button', () => {
    it('should render the back button', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      const backButton = screen.getByRole('button', { name: /back to home/i });
      expect(backButton).toBeInTheDocument();
    });

    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<PrivacyPolicy onBack={mockOnBack} />);

      const backButton = screen.getByRole('button', { name: /back to home/i });
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should use semantic article element', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<PrivacyPolicy onBack={mockOnBack} />);

      // Main heading is h1
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/privacy policy/i);

      // Section headings are h2
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      expect(h2Headings.length).toBeGreaterThanOrEqual(9);

      // Subsection headings are h3
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings.length).toBeGreaterThanOrEqual(4);
    });

    it('should have header element containing the main heading', () => {
      const { container } = render(<PrivacyPolicy onBack={mockOnBack} />);

      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
      expect(header).toContainElement(screen.getByRole('heading', { level: 1 }));
    });
  });
});
