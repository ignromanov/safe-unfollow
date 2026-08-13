import { vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import translation before mocking
import heroEN from '@/locales/en/hero.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';
import * as analytics from '@/lib/analytics';

vi.mock('react-i18next', () => createI18nMock(heroEN));

// Mock analytics module — a <Link>'s onClick fires synchronously before
// navigation, so a real click event exercises it the same way a browser does.
vi.mock('@/lib/analytics', () => ({
  analytics: {
    heroCTAGuide: vi.fn(),
    heroCTASample: vi.fn(),
    heroCTAUploadDirect: vi.fn(),
    heroCTAContinue: vi.fn(),
  },
}));

import { Hero } from '@/components/Hero';

describe('Hero Component', () => {
  const defaultProps = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render main headline with translated text', () => {
      render(<Hero {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent(heroEN.headline.prefix);
      expect(heading).toHaveTextContent(heroEN.headline.highlight);
      expect(heading).toHaveTextContent(heroEN.headline.suffix);
    });

    it('should render subheadline', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByText(heroEN.subheadline)).toBeInTheDocument();
    });

    it('should render version badge', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByText(heroEN.version)).toBeInTheDocument();
    });
  });

  describe('CTA buttons', () => {
    it('should render primary CTA link when no data', () => {
      render(<Hero {...defaultProps} hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toBeInTheDocument();
    });

    it('should render "View Results" link when hasData is true', () => {
      render(<Hero {...defaultProps} hasData={true} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.viewResults, 'i') })
      ).toBeInTheDocument();
    });

    it('should render sample data link', () => {
      render(<Hero {...defaultProps} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toBeInTheDocument();
    });

    it('should render "I already have my ZIP file" link when no data', () => {
      render(<Hero {...defaultProps} hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toBeInTheDocument();
    });

    it('should not render "I already have my ZIP file" link when hasData is true', () => {
      render(<Hero {...defaultProps} hasData={true} />);

      expect(
        screen.queryByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).not.toBeInTheDocument();
    });
  });

  describe('trust badges', () => {
    it('should render trust badges', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByText(heroEN.trust.free)).toBeInTheDocument();
      expect(screen.getByText(heroEN.trust.noPassword)).toBeInTheDocument();
      expect(screen.getByText(heroEN.trust.privacy)).toBeInTheDocument();
    });
  });

  describe('feature cards', () => {
    it('should render all four feature cards', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByText(heroEN.features.local.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.noLogin.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.scale.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.openSource.title)).toBeInTheDocument();
    });

    it('should render feature descriptions', () => {
      render(<Hero {...defaultProps} />);

      expect(screen.getByText(heroEN.features.local.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.noLogin.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.scale.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.openSource.description)).toBeInTheDocument();
    });
  });

  describe('CTA hrefs', () => {
    // A <button> calling useNavigate() is dead until React hydrates — 3.7s on a cold
    // mobile load. An anchor navigates natively that whole time.
    it('renders the primary CTA as a real anchor to the wizard', () => {
      render(<Hero hasData={false} />);
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toHaveAttribute('href', '/wizard/step/1');
    });

    it('renders the sample CTA as a real anchor', () => {
      render(<Hero hasData={false} />);
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toHaveAttribute('href', '/sample');
    });

    it('renders the direct-upload CTA as a real anchor', () => {
      render(<Hero hasData={false} />);
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toHaveAttribute('href', '/upload');
    });

    it('renders the results CTA as a real anchor when data is loaded', () => {
      render(<Hero hasData={true} />);
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.viewResults, 'i') })
      ).toHaveAttribute('href', '/results');
    });

    it('prefixes every CTA href with the current language', () => {
      render(<Hero hasData={false} />, { initialEntries: ['/ru/'] });
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toHaveAttribute('href', '/ru/wizard/step/1');
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toHaveAttribute('href', '/ru/sample');
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toHaveAttribute('href', '/ru/upload');
    });
  });

  describe('CTA analytics', () => {
    // Link renders a real anchor AND still fires the caller's onClick
    // synchronously before it navigates — none of these handlers call
    // preventDefault(), so nothing here suppresses the anchor's own href
    // navigation. Losing the onClick (accidentally, or in a future refactor
    // away from Link) would make hero_cta_* silently stop counting clicks
    // without breaking navigation, which is exactly the failure mode this
    // guards against.
    it('fires heroCTAGuide when the primary CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<Hero hasData={false} />);

      await user.click(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      );

      expect(analytics.analytics.heroCTAGuide).toHaveBeenCalledTimes(1);
    });

    it('fires heroCTASample when the sample CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<Hero hasData={false} />);

      await user.click(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      );

      expect(analytics.analytics.heroCTASample).toHaveBeenCalledTimes(1);
    });

    it('fires heroCTAUploadDirect when the direct-upload CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<Hero hasData={false} />);

      await user.click(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      );

      expect(analytics.analytics.heroCTAUploadDirect).toHaveBeenCalledTimes(1);
    });

    it('fires heroCTAContinue when the results CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<Hero hasData={true} />);

      await user.click(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.viewResults, 'i') })
      );

      expect(analytics.analytics.heroCTAContinue).toHaveBeenCalledTimes(1);
    });
  });
});
