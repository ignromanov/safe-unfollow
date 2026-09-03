import { vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/__tests__/test-utils';
import howtoEN from '@/locales/en/howto.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(howtoEN));

import { HowToSection } from '@/components/HowToSection';
import { GUIDE_STEPS } from '@/config/wizard-steps';

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

    it('should show one Critical badge per warning step and no more', () => {
      renderWithRouter(<HowToSection />);

      // Derived from GUIDE_STEPS, because this section's step list is now
      // built from it — a badge count that drifts from the config is the
      // defect being asserted. The previous `toBeGreaterThanOrEqual(1)` was
      // green throughout the period when this page marked two steps critical
      // and wizard-steps.ts marked one.
      const warningCount = GUIDE_STEPS.filter(step => step.isWarning).length;
      expect(screen.getAllByText('Critical')).toHaveLength(warningCount);
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
    // The number on the card IS the section number in its URL, for every card
    // that has a section. That is what this block exists to hold, and it did
    // not hold: while "Open Accounts Center" sat outside the guide's
    // numbering, card 6 linked to `?step=5` and the reader arrived at a dialog
    // headed "Step 5 of 7" for the instruction they had just seen numbered 6.
    // The version of this test that shipped asserted `?step=${card - 1}` and
    // passed — a gate can hold a wrong fact in place, and it looks exactly
    // like a correct gate until you know the fact moved.
    it('should give the how-to one card per guide section, plus the hand-off', () => {
      // Derived from GUIDE_STEPS so the two lists cannot drift apart again.
      // The extra card is ours, not Meta's: "Upload Your File" is the only
      // step of the nine that does not happen inside Instagram.
      expect(STEP_TITLES).toHaveLength(GUIDE_STEPS.length + 1);
    });

    it('should link every card but the last to the section that shares its number', () => {
      renderWithRouter(<HowToSection />);

      STEP_TITLES.slice(0, -1).forEach((title, idx) => {
        const card = idx + 1;
        const link = screen.getByRole('link', { name: stepAriaLabel(card, title) });
        expect(link, `card ${card}`).toHaveAttribute('href', `/upload?step=${card}`);
      });
    });

    it('should link the last step card to the upload page', () => {
      renderWithRouter(<HowToSection />);

      const last = STEP_TITLES.length;
      const link = screen.getByRole('link', { name: stepAriaLabel(last, STEP_TITLES[last - 1]) });
      expect(link).toHaveAttribute('href', '/upload');
    });

    it('should link the final CTA to the guide', () => {
      renderWithRouter(<HowToSection />);

      const cta = screen.getByRole('link', { name: /Open Analysis Guide/i });
      expect(cta).toHaveAttribute('href', '/upload?guide=1');
    });

    // `?guide=1` and `?step=N` are two different query shapes through the same
    // PrefixedLink, and only the first was pinned. Eight of the nine rows on
    // every localized page use the `?step=` form, so a prefixing regression
    // that spared `?guide=1` would drop nine locales' worth of section links
    // into the English funnel with no runtime symptom.
    it('should carry the language prefix on the guide CTA', () => {
      renderWithRouter(<HowToSection />, { initialEntries: ['/id'] });

      const cta = screen.getByRole('link', { name: /Open Analysis Guide/i });
      expect(cta).toHaveAttribute('href', '/id/upload?guide=1');
    });

    it('should carry the language prefix on a step-section link too', () => {
      renderWithRouter(<HowToSection />, { initialEntries: ['/id'] });

      const link = screen.getByRole('link', { name: stepAriaLabel(1, STEP_TITLES[0]) });
      expect(link).toHaveAttribute('href', '/id/upload?step=1');
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
