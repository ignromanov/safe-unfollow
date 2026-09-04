import { vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithRouter } from '@/__tests__/test-utils';
import howtoEN from '@/locales/en/howto.json';
import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Two namespaces, nested rather than merged: both bundles define `steps`, and a
// flat spread would let wizard's eight silently replace howto's nine.
vi.mock('react-i18next', () => createI18nMock({ ...howtoEN, wizard: wizardEN }));

import { HowToSection } from '@/components/HowToSection';
import { ACCOUNTS_CENTER_URL, GUIDE_STEPS } from '@/config/wizard-steps';

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

/** The card carrying a heading, for a section whose rows are no longer links. */
function card(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: new RegExp(escapeRe(title)) })
    .closest('li')!;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  describe('actions', () => {
    // The rows stopped being links. Every card used to be an anchor into the
    // guide dialog on /upload — nine links to one screen, from a section that
    // already renders the same eight posters and the same eight instructions.
    // The page has to answer the question by itself, so the only links left in
    // the list are the two things a reader can actually do from here.
    it('should give the how-to one card per guide section, plus the hand-off', () => {
      // Derived from GUIDE_STEPS so the two lists cannot drift apart. The extra
      // card is ours, not Meta's: "Upload Your File" is the only step of the
      // nine that does not happen inside Instagram.
      expect(STEP_TITLES).toHaveLength(GUIDE_STEPS.length + 1);
    });

    it('should send step 1 to Accounts Center, in a new tab', () => {
      renderWithRouter(<HowToSection />);

      const link = within(card(STEP_TITLES[0]!)).getByRole('link');
      expect(link).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('should send the last step to the upload page', () => {
      renderWithRouter(<HowToSection />);

      const link = within(card(STEP_TITLES[STEP_TITLES.length - 1]!)).getByRole('link');
      expect(link).toHaveAttribute('href', '/upload');
    });

    it('should leave every step between them without a link', () => {
      renderWithRouter(<HowToSection />);

      for (const title of STEP_TITLES.slice(1, -1)) {
        expect(within(card(title!)).queryAllByRole('link'), title).toHaveLength(0);
      }
    });

    it('should not open the guide dialog from any step card', () => {
      // The guard this block exists for. `?step=` was on nine anchors here;
      // the CTA below is the one deliberate way into the dialog from this page,
      // and it opens the guide at its start rather than at a section.
      const { container } = renderWithRouter(<HowToSection />);

      const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
      expect(hrefs.filter(href => href?.includes('step='))).toEqual([]);
    });

    it('should link the final CTA to the guide', () => {
      renderWithRouter(<HowToSection />);

      const cta = screen.getByRole('link', { name: /Open Analysis Guide/i });
      expect(cta).toHaveAttribute('href', '/upload?guide=1');
    });

    it('should carry the language prefix on both internal links', () => {
      // `?guide=1` and a bare path are two shapes through the same
      // PrefixedLink. The Accounts Center link is deliberately absent from this
      // assertion: it is external and must NOT be prefixed.
      renderWithRouter(<HowToSection />, { initialEntries: ['/id'] });

      expect(screen.getByRole('link', { name: /Open Analysis Guide/i })).toHaveAttribute(
        'href',
        '/id/upload?guide=1'
      );
      const last = within(card(STEP_TITLES[STEP_TITLES.length - 1]!)).getByRole('link');
      expect(last).toHaveAttribute('href', '/id/upload');
    });

    it('should not prefix the external Accounts Center link with a locale', () => {
      renderWithRouter(<HowToSection />, { initialEntries: ['/id'] });

      const link = within(card(STEP_TITLES[0]!)).getByRole('link');
      expect(link).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
    });
  });

  describe('keyboard accessibility', () => {
    // The hand-rolled onKeyDown handler these tests used to assert is long
    // gone, and so is the anchor that replaced it on every card: the rows are
    // content, and content is not something to operate. What remains keyboard-
    // operable is what is actually actionable, and it is native <a> in both
    // cases rather than a div with a click handler.
    it('should expose exactly the two step actions as native anchors', () => {
      renderWithRouter(<HowToSection />);

      const first = within(card(STEP_TITLES[0]!)).getByRole('link');
      const last = within(card(STEP_TITLES[STEP_TITLES.length - 1]!)).getByRole('link');
      expect(first.tagName).toBe('A');
      expect(last.tagName).toBe('A');
    });
  });
});
