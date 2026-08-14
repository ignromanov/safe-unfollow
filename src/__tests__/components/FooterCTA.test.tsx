import { vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import commonEN from '@/locales/en/common.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';

vi.mock('react-i18next', () => createI18nMock(commonEN));

import { FooterCTA } from '@/components/FooterCTA';

describe('FooterCTA Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<FooterCTA />);

      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should render CTA title', () => {
      render(<FooterCTA />);

      expect(screen.getByText(commonEN.cta.title)).toBeInTheDocument();
    });

    it('should render CTA subtitle', () => {
      render(<FooterCTA />);

      expect(screen.getByText(commonEN.cta.subtitle)).toBeInTheDocument();
    });

    it('should render tagline', () => {
      render(<FooterCTA />);

      expect(screen.getByText(commonEN.cta.tagline)).toBeInTheDocument();
    });

    it('should render Logo component', () => {
      render(<FooterCTA />);

      // Logo renders as an img element
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('CTA links', () => {
    it('should render Get Started link', () => {
      render(<FooterCTA />);

      expect(screen.getByRole('link', { name: /Get Started/i })).toBeInTheDocument();
    });

    it('should render Try Sample link', () => {
      render(<FooterCTA />);

      expect(screen.getByRole('link', { name: /Try Sample/i })).toBeInTheDocument();
    });
  });

  describe('CTA hrefs', () => {
    // A <button onClick={navigate}> is dead until React hydrates. FooterCTA renders real
    // anchors via PrefixedLink so the browser can follow them during that window.
    it('renders the Get Started control as a real anchor to the wizard', () => {
      render(<FooterCTA />);

      expect(screen.getByRole('link', { name: /Get Started/i })).toHaveAttribute(
        'href',
        '/wizard/step/1'
      );
    });

    it('renders the Try Sample control as a real anchor', () => {
      render(<FooterCTA />);

      expect(screen.getByRole('link', { name: /Try Sample/i })).toHaveAttribute('href', '/sample');
    });

    it('prefixes both hrefs with the current language', () => {
      render(<FooterCTA />, { initialEntries: ['/id'] });

      expect(screen.getByRole('link', { name: /Get Started/i })).toHaveAttribute(
        'href',
        '/id/wizard/step/1'
      );
      expect(screen.getByRole('link', { name: /Try Sample/i })).toHaveAttribute(
        'href',
        '/id/sample'
      );
    });
  });
});
