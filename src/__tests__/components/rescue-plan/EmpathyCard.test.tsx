import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { EmpathyCard } from '@/components/rescue-plan/EmpathyCard';
import type { UserSegment } from '@/lib/rescue-plan/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeSegment(severity: UserSegment['severity'], size: UserSegment['size']): UserSegment {
  const percentMap = { critical: 15, warning: 5, growth: 1 };
  const totalMap = { influencer: 15000, power: 5000, regular: 1000, casual: 200 };
  return {
    severity,
    size,
    unfollowedPercent: percentMap[severity],
    totalAccounts: totalMap[size],
  };
}

describe('EmpathyCard', () => {
  it('renders for critical_casual', () => {
    render(<EmpathyCard segment={makeSegment('critical', 'casual')} />);
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it('renders for critical_regular', () => {
    render(<EmpathyCard segment={makeSegment('critical', 'regular')} />);
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it('does not render for critical_power', () => {
    const { container } = render(<EmpathyCard segment={makeSegment('critical', 'power')} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render for critical_influencer', () => {
    const { container } = render(<EmpathyCard segment={makeSegment('critical', 'influencer')} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render for warning severity', () => {
    const { container } = render(<EmpathyCard segment={makeSegment('warning', 'casual')} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render for growth severity', () => {
    const { container } = render(<EmpathyCard segment={makeSegment('growth', 'regular')} />);
    expect(container.firstChild).toBeNull();
  });

  it('links to headspace', () => {
    render(<EmpathyCard segment={makeSegment('critical', 'casual')} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toContain('headspace');
  });
});
