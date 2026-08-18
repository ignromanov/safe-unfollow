import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Component as WizardPage } from '@/pages/WizardPage';

// Mock Wizard component. WizardPage no longer threads navigation callbacks into it —
// every control inside Wizard computes its own destination via PrefixedLink (GH#50),
// so this page's only job is to render Wizard. Its own navigation behavior is covered
// by src/__tests__/components/Wizard.test.tsx.
vi.mock('@/components/Wizard', () => ({
  Wizard: () => (
    <div data-testid="wizard">
      <h1>Instagram Export Wizard</h1>
    </div>
  ),
}));

describe('WizardPage', () => {
  it('should render without crashing', () => {
    render(<WizardPage />);

    expect(screen.getByTestId('wizard')).toBeInTheDocument();
  });

  it('should render Wizard component', () => {
    render(<WizardPage />);

    expect(screen.getByText('Instagram Export Wizard')).toBeInTheDocument();
  });
});
