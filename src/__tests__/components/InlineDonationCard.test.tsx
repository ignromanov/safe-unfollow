import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    donationCardImpression: vi.fn(),
    donationCardClick: vi.fn(),
    donationCardDismiss: vi.fn(),
  },
}));

import { InlineDonationCard } from '@/components/InlineDonationCard';

/** Class tokens, split so a substring never passes for a whole utility. */
function classesOf(element: Element): string[] {
  return element.className.split(/\s+/).filter(Boolean);
}

describe('InlineDonationCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render the donate link', () => {
    render(<InlineDonationCard accountCount={1200} />);

    expect(screen.getByRole('link', { name: /coffee|support/i })).toBeInTheDocument();
  });

  /**
   * The weight guard.
   *
   * jsdom computes no layout, so nothing here can see that this card used to
   * shout louder than the paid export beside it. What it can pin is the
   * treatment that did the shouting: a filled-primary fill is the one visual
   * rank a screen gets to hand out once, and on /results it belongs to the
   * export trigger, whose click delivers a file and nets $5.50. A donation
   * link may not take it back.
   *
   * Deliberately a token-exact check: `hover:bg-primary/10` is the demoted
   * hover tint and must keep passing, so a substring match on "bg-primary"
   * would fail against the very styling this test is meant to protect.
   */
  it('should not dress the donate link as the primary action', () => {
    render(<InlineDonationCard accountCount={1200} />);

    const classes = classesOf(screen.getByRole('link', { name: /coffee|support/i }));

    expect(classes).not.toContain('bg-primary');
    expect(classes).not.toContain('text-primary-foreground');
    expect(classes).not.toContain('shadow-lg');
    expect(classes).not.toContain('hover:scale-105');
  });

  // Quiet is not inert. A demotion that also strips the focus ring hands the
  // cost of the change to keyboard users, who are the ones who cannot see a
  // hover state at all.
  it('should keep a visible focus ring on the donate link', () => {
    render(<InlineDonationCard accountCount={1200} />);

    const classes = classesOf(screen.getByRole('link', { name: /coffee|support/i }));

    expect(classes.some(c => c.startsWith('focus-visible:ring'))).toBe(true);
  });
});
