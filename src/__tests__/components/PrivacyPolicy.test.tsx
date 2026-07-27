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

      expect(screen.getByText(/last updated: july 27, 2026/i)).toBeInTheDocument();
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

      expect(screen.getByText(/5\.3 Advertising \(Google AdSense\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Ads are never targeted using your Instagram data/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/consent management platform/i)).toBeInTheDocument();
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
