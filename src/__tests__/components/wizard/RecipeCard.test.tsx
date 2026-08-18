import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { RecipeCard } from '@/components/wizard/RecipeCard';

describe('RecipeCard', () => {
  it('carries no ordinals — it is reference, not a second set of instructions', () => {
    render(<RecipeCard />);

    const card = screen.getByRole('group', { name: /instagram's dialog/i });
    expect(within(card).queryByText(/^\s*\d+[.)]/)).not.toBeInTheDocument();
  });

  it('names the format as a value, because this is the only place a value lives', () => {
    render(<RecipeCard />);

    expect(screen.getByText(/JSON/)).toBeInTheDocument();
  });

  it('keeps Latin tokens left-to-right in Arabic', () => {
    render(<RecipeCard />);

    expect(screen.getByText('JSON')).toHaveAttribute('dir', 'ltr');
  });
});
