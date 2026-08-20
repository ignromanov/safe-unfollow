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

  // The recipe exists to prevent one failure: html_format is 55.2% of all
  // upload errors. The format row is the setting readers get wrong, and the
  // artboard marks it in the same amber the format-error screen uses for the
  // failure once it has happened. Rendered like its four neighbours it
  // carries no signal, so the invariant is "exactly one row is marked, and it
  // is that one" — a fifth green check would pass every other test here.
  it('marks the format row, and only the format row', () => {
    render(<RecipeCard />);

    const card = screen.getByRole('group', { name: /instagram's dialog/i });
    const marked = Array.from(card.querySelectorAll('li')).filter(row =>
      /amber/.test(row.className)
    );

    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent(/JSON/);
  });

  it('names the format as a value, because this is the only place a value lives', () => {
    render(<RecipeCard />);

    expect(screen.getByText(/JSON/)).toBeInTheDocument();
  });

  it('keeps Latin tokens left-to-right in Arabic', () => {
    render(<RecipeCard />);

    expect(screen.getByText('JSON')).toHaveAttribute('dir', 'ltr');
  });

  // The isolation is a search-and-wrap, so a translation that drops the token
  // silently stops being isolated. The row must still say what the
  // translation says — losing the wrapper must not lose the sentence.
  it('renders the row whole when a translation carries no JSON token', () => {
    const original = wizardEN.entry.recipe.rows.format;
    wizardEN.entry.recipe.rows.format = 'Format: the token went missing';

    try {
      render(<RecipeCard />);

      const card = screen.getByRole('group', { name: /instagram's dialog/i });
      expect(within(card).getByText('Format: the token went missing')).toBeInTheDocument();
      expect(card.querySelector('[dir="ltr"]')).toBeNull();
    } finally {
      wizardEN.entry.recipe.rows.format = original;
    }
  });
});
