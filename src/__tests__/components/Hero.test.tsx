import { vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

// Import translation before mocking
import heroEN from '@/locales/en/hero.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';

vi.mock('react-i18next', () => createI18nMock(heroEN));

import { Hero } from '@/components/Hero';

describe('Hero Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Hero />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render main headline with translated text', () => {
      render(<Hero />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent(heroEN.headline.prefix);
      expect(heading).toHaveTextContent(heroEN.headline.highlight);
      expect(heading).toHaveTextContent(heroEN.headline.suffix);
    });

    it('should render subheadline', () => {
      render(<Hero />);

      expect(screen.getByText(heroEN.subheadline)).toBeInTheDocument();
    });

    it('should render version badge', () => {
      render(<Hero />);

      expect(screen.getByText(heroEN.version)).toBeInTheDocument();
    });
  });

  describe('CTA buttons', () => {
    it('should render primary CTA link when no data', () => {
      render(<Hero hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toBeInTheDocument();
    });

    it('should render "View Results" link when hasData is true', () => {
      render(<Hero hasData={true} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.viewResults, 'i') })
      ).toBeInTheDocument();
    });

    it('should render sample data link', () => {
      render(<Hero />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toBeInTheDocument();
    });

    it('should render "I already have my ZIP file" link when no data', () => {
      render(<Hero hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toBeInTheDocument();
    });

    // The whole of GH#86 is an ordering claim, and ordering is the part a
    // restyle can silently undo: the ZIP-holder path must reach the reader —
    // and the keyboard — before the sample link, not after the trust row.
    // Asserting the presence of both links, which the two tests above already
    // do, passes just as well when this control is a footnote again.
    it('puts the ZIP-holder path ahead of the sample link', () => {
      render(<Hero hasData={false} />);

      const haveFile = screen.getByRole('link', {
        name: new RegExp(heroEN.buttons.haveFile, 'i'),
      });
      const sample = screen.getByRole('link', {
        name: new RegExp(heroEN.buttons.trySample, 'i'),
      });

      expect(haveFile.compareDocumentPosition(sample)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('should not render "I already have my ZIP file" link when hasData is true', () => {
      render(<Hero hasData={true} />);

      expect(
        screen.queryByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).not.toBeInTheDocument();
    });
  });

  describe('trust badges', () => {
    it('should render trust badges', () => {
      render(<Hero />);

      expect(screen.getByText(heroEN.trust.free)).toBeInTheDocument();
      expect(screen.getByText(heroEN.trust.noPassword)).toBeInTheDocument();
      expect(screen.getByText(heroEN.trust.privacy)).toBeInTheDocument();
    });
  });

  describe('feature cards', () => {
    it('should render all four feature cards', () => {
      render(<Hero />);

      expect(screen.getByText(heroEN.features.local.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.noLogin.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.scale.title)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.openSource.title)).toBeInTheDocument();
    });

    it('should render feature descriptions', () => {
      render(<Hero />);

      expect(screen.getByText(heroEN.features.local.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.noLogin.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.scale.description)).toBeInTheDocument();
      expect(screen.getByText(heroEN.features.openSource.description)).toBeInTheDocument();
    });
  });

  describe('CTA hrefs', () => {
    // A <button> calling useNavigate() is dead until React hydrates — 3.7s on a cold
    // mobile load. An anchor navigates natively that whole time.
    it('renders the primary CTA as a real anchor that opens the guide', () => {
      render(<Hero hasData={false} />);
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toHaveAttribute('href', '/upload?guide=1');
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
      ).toHaveAttribute('href', '/ru/upload?guide=1');
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toHaveAttribute('href', '/ru/sample');
      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toHaveAttribute('href', '/ru/upload');
    });
  });

  describe('CTA analytics', () => {
    // The recorder is the capture-phase listener in index.html, not onClick: a click in
    // the hydration window follows the href with no React handler running, and used to
    // lose both the event and the session's entry_cta (GH#99). The listener can only see
    // what the prerendered markup says, so the attribute IS the instrumentation — losing
    // it makes hero_cta_* stop counting without breaking navigation, which is the failure
    // this guards against.
    it('marks the guide CTA', () => {
      render(<Hero hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.getGuide, 'i') })
      ).toHaveAttribute('data-cta', 'guide');
    });

    it('marks the sample CTA', () => {
      render(<Hero hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.trySample, 'i') })
      ).toHaveAttribute('data-cta', 'sample');
    });

    it('marks the direct-upload CTA', () => {
      render(<Hero hasData={false} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.haveFile, 'i') })
      ).toHaveAttribute('data-cta', 'upload_direct');
    });

    it('marks the results CTA', () => {
      render(<Hero hasData={true} />);

      expect(
        screen.getByRole('link', { name: new RegExp(heroEN.buttons.viewResults, 'i') })
      ).toHaveAttribute('data-cta', 'continue');
    });
  });
});
