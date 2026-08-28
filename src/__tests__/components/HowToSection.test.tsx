import { vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/__tests__/test-utils';
import howtoEN from '@/locales/en/howto.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(howtoEN));

import { HowToSection } from '@/components/HowToSection';

// Step titles indexed by step number (1-9), avoiding a computed-key lookup on the
// narrowly-typed `howtoEN.steps` object.
const STEP_TITLES = [
  howtoEN.steps['1'].title,
  howtoEN.steps['2'].title,
  howtoEN.steps['3'].title,
  howtoEN.steps['4'].title,
  howtoEN.steps['5'].title,
  howtoEN.steps['6'].title,
  howtoEN.steps['7'].title,
  howtoEN.steps['8'].title,
  howtoEN.steps['9'].title,
];

// Mirrors the mockI18n interpolation used for openStepAria, which becomes the accessible
// name of each step's PrefixedLink via its aria-label.
function stepAriaLabel(step: number, title: string): string {
  return howtoEN.openStepAria.replace('{{step}}', String(step)).replace('{{title}}', title);
}

describe('HowToSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderWithRouter(<HowToSection />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should render the section with correct id', () => {
    const { container } = renderWithRouter(<HowToSection />);

    const section = container.querySelector('#how-it-works');
    expect(section).toBeInTheDocument();
  });

  it('should render subtitle text', () => {
    renderWithRouter(<HowToSection />);

    expect(screen.getByText(/Follow these 9 simple steps to securely analyze/)).toBeInTheDocument();
  });

  describe('how-to steps', () => {
    it('should render all 9 steps', () => {
      renderWithRouter(<HowToSection />);

      // Check step numbers are rendered
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument();
      }
    });

    it('should render step titles', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(howtoEN.steps['1'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['2'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['3'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['4'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['5'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['6'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['7'].title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['8'].title)).toBeInTheDocument();
    });

    it('should render step descriptions', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(/Click the button to open Meta Accounts Center/)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.steps['6'].description)).toBeInTheDocument();
    });

    it('should show Critical badge for warning steps', () => {
      renderWithRouter(<HowToSection />);

      const criticalBadges = screen.getAllByText('Critical');
      expect(criticalBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('should render step videos with poster images', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const videos = container.querySelectorAll('video');
      expect(videos.length).toBeGreaterThan(0);

      videos.forEach(video => {
        expect(video).toHaveAttribute('poster');
      });
    });
  });

  describe('Schema.org JSON-LD', () => {
    it('should contain HowTo structured data script', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();
    });

    it('should have valid HowTo schema structure', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();

      const schema = JSON.parse(script!.innerHTML);

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('HowTo');
      expect(schema.name).toBe(howtoEN.schema.name);
      expect(schema.totalTime).toBe('PT5M');
    });

    it('should include all steps in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.step).toHaveLength(9);
      expect(schema.step[0]['@type']).toBe('HowToStep');
      expect(schema.step[0].position).toBe(1);
      expect(schema.step[0].name).toBe(howtoEN.steps['1'].title);
    });

    it('should include supplies and tools in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.supply).toHaveLength(2);
      expect(schema.supply[0].name).toBe(howtoEN.schema.supplies.account);
      expect(schema.tool).toHaveLength(1);
      expect(schema.tool[0].name).toBe(howtoEN.schema.tool);
    });

    it('should include estimated cost in schema', () => {
      const { container } = renderWithRouter(<HowToSection />);

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.innerHTML);

      expect(schema.estimatedCost).toEqual({
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: '0',
      });
    });
  });

  describe('CTA section', () => {
    it('should render CTA title and subtitle', () => {
      renderWithRouter(<HowToSection />);

      expect(screen.getByText(howtoEN.cta.title)).toBeInTheDocument();
      expect(screen.getByText(howtoEN.cta.subtitle)).toBeInTheDocument();
    });

    it('should render CTA link', () => {
      renderWithRouter(<HowToSection />);

      const cta = screen.getByRole('link', { name: /Open Analysis Guide/i });
      expect(cta).toBeInTheDocument();
    });
  });

  describe('step links', () => {
    it('should link step cards 1-8 to their wizard step', () => {
      renderWithRouter(<HowToSection />);

      STEP_TITLES.slice(0, 8).forEach((title, idx) => {
        const step = idx + 1;
        const link = screen.getByRole('link', { name: stepAriaLabel(step, title) });
        expect(link).toHaveAttribute('href', `/wizard/step/${step}`);
      });
    });

    it('should link the ninth step card to the upload page', () => {
      renderWithRouter(<HowToSection />);

      const link = screen.getByRole('link', { name: stepAriaLabel(9, STEP_TITLES[8]) });
      expect(link).toHaveAttribute('href', '/upload');
    });

    it('should link the final CTA to wizard step 1', () => {
      renderWithRouter(<HowToSection />);

      const cta = screen.getByRole('link', { name: /Open Analysis Guide/i });
      expect(cta).toHaveAttribute('href', '/wizard/step/1');
    });

    it('should carry the language prefix on step links under a localized route', () => {
      renderWithRouter(<HowToSection />, { initialEntries: ['/id'] });

      const link = screen.getByRole('link', { name: stepAriaLabel(1, STEP_TITLES[0]) });
      expect(link).toHaveAttribute('href', '/id/wizard/step/1');
    });
  });

  describe('keyboard accessibility', () => {
    // The hand-rolled onKeyDown handler (Enter/Space) that these tests used to assert is
    // gone — each step card is now a PrefixedLink, i.e. a real <a href>, which browsers
    // make keyboard-operable natively. Asserting the anchor tag is the accessibility
    // property that actually matters post-refactor; there is no custom key handling left
    // to test.
    it('should render every step card as a native anchor', () => {
      renderWithRouter(<HowToSection />);

      STEP_TITLES.forEach((title, idx) => {
        const step = idx + 1;
        const link = screen.getByRole('link', { name: stepAriaLabel(step, title) });
        expect(link.tagName).toBe('A');
      });
    });
  });
});
