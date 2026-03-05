import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import commonEN from '@/locales/en/common.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(commonEN));

import { TermsOfService } from '@/components/TermsOfService';

describe('TermsOfService', () => {
  const defaultProps = {
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should render Terms of Service heading', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Terms of Service' })
      ).toBeInTheDocument();
    });

    it('should render last updated date', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('Last updated: January 9, 2026')).toBeInTheDocument();
    });
  });

  describe('TL;DR section', () => {
    it('should render TL;DR heading', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('TL;DR — Key Points')).toBeInTheDocument();
    });

    it('should render key points', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('Free to Use')).toBeInTheDocument();
      expect(screen.getByText('Your Responsibility')).toBeInTheDocument();
      expect(screen.getByText('No Warranties')).toBeInTheDocument();
      expect(screen.getByText('Not Affiliated')).toBeInTheDocument();
    });

    it('should mention MIT license', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText(/open-source under the MIT license/)).toBeInTheDocument();
    });
  });

  describe('terms sections', () => {
    it('should render Acceptance of Terms section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument();
    });

    it('should render Description of Service section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('2. Description of Service')).toBeInTheDocument();
    });

    it('should render User Responsibilities section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('3. User Responsibilities')).toBeInTheDocument();
    });

    it('should render Instagram Data section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('4. Instagram Data and Third-Party Services')).toBeInTheDocument();
    });

    it('should render Intellectual Property section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('5. Intellectual Property')).toBeInTheDocument();
    });

    it('should render Disclaimer of Warranties section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('6. Disclaimer of Warranties')).toBeInTheDocument();
    });

    it('should render Limitation of Liability section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('7. Limitation of Liability')).toBeInTheDocument();
    });

    it('should render Contact section', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByText('13. Contact')).toBeInTheDocument();
    });
  });

  describe('content details', () => {
    it('should mention that service processes data locally', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(
        screen.getByText(
          /Processes Instagram data export files \(ZIP format\) entirely in your browser/
        )
      ).toBeInTheDocument();
    });

    it('should mention never transmitting data to servers', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(
        screen.getByText(/Never transmits your Instagram data to any server/)
      ).toBeInTheDocument();
    });

    it('should render contact email link', () => {
      render(<TermsOfService {...defaultProps} />);

      const emailLink = screen.getByRole('link', { name: 'hello@safeunfollow.app' });
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:hello@safeunfollow.app');
    });

    it('should render GitHub link', () => {
      render(<TermsOfService {...defaultProps} />);

      const githubLink = screen.getByRole('link', { name: /GitHub/ });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/ignromanov/safe-unfollow');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render acceptance notice', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(
        screen.getByText(/By using SafeUnfollow, you acknowledge that you have read, understood/)
      ).toBeInTheDocument();
    });
  });

  describe('back button', () => {
    it('should render back button', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    });

    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<TermsOfService {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /back to home/i }));

      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('should not call onBack on initial render', () => {
      render(<TermsOfService {...defaultProps} />);

      expect(defaultProps.onBack).not.toHaveBeenCalled();
    });
  });
});
