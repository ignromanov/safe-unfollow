import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';
import { GUIDE_STEPS } from '@/config/wizard-steps';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { StepAccordion } from '@/components/wizard/StepAccordion';

/** The rows, without the disclosure trigger that shares their role. */
function rows() {
  return screen
    .queryAllByRole('button')
    .filter(button => !/step-by-step/i.test(button.textContent ?? ''));
}

describe('StepAccordion', () => {
  it('is closed on first paint and holds no video', () => {
    const { container } = render(<StepAccordion />);

    expect(container.querySelector('video')).toBeNull();
    // Closed rows are not mounted, so "not reachable" is the correct assertion
    // form here — see task-3 controller ruling 2 (toBeVisible() throws on null).
    expect(
      screen.queryByRole('button', { name: wizardEN.steps['1'].title })
    ).not.toBeInTheDocument();
  });

  it('opens to one row per section', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    expect(rows()).toHaveLength(GUIDE_STEPS.length);
  });

  it('asks its caller for a section rather than navigating', async () => {
    // The rows became buttons when the guide became a dialog, and that costs
    // nothing here: they do not exist until the disclosure above is clicked,
    // so they were never reachable in the pre-hydration window a real href
    // exists to serve.
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<StepAccordion onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));
    await user.click(rows()[0]!);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('reserves each poster box before the image loads', async () => {
    const user = userEvent.setup();
    const { container } = render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    // Queried by tag, not by role: the posters are decorative (alt=""), which
    // is exactly what takes them out of the accessibility tree.
    const poster = container.querySelectorAll('img')[0]!;
    expect(poster).toHaveAttribute('loading', 'lazy');
    expect(poster).toHaveAttribute('width');
    expect(poster).toHaveAttribute('height');
  });

  it("reserves the 5:3 posters' boxes from their own intrinsic size, not the 4:3 default", async () => {
    const user = userEvent.setup();
    const { container } = render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    // Steps 1 and 2 are both 600x360; every step after them is 600x450.
    // Two 5:3 rows, not one — `step-1` came back into the list when "Open
    // Accounts Center" became a numbered step, and it shares step 2's shape.
    const posters = container.querySelectorAll('img');
    for (const poster of [posters[0], posters[1]]) {
      expect(poster).toHaveAttribute('width', '600');
      expect(poster).toHaveAttribute('height', '360');
    }
    expect(posters[2]).toHaveAttribute('width', '600');
    expect(posters[2]).toHaveAttribute('height', '450');
  });

  it('toggles closed again on a second click', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);
    const trigger = screen.getByRole('button', { name: /step-by-step/i });

    await user.click(trigger);
    expect(rows()).toHaveLength(GUIDE_STEPS.length);

    await user.click(trigger);
    expect(rows()).toHaveLength(0);
  });

  it('labels the closed trigger with the derived step count, matching the links it opens to', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    const trigger = screen.getByRole('button', { name: /step-by-step/i });
    const expectedCount = GUIDE_STEPS.length;
    // Proves the count is read from config, not a copied literal: it has
    // to equal the number of rows the same click actually reveals.
    expect(trigger).toHaveTextContent(String(expectedCount));

    await user.click(trigger);
    expect(rows()).toHaveLength(expectedCount);
  });

  it('labels the whole row so the row text names a real step', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    const firstRow = rows()[0]!;
    expect(within(firstRow).getByText(wizardEN.steps['1'].title)).toBeInTheDocument();
    // And names it once: the poster is decorative, so the row's accessible
    // name is the visible label alone, not that label preceded by a near
    // paraphrase of itself from the poster's alt.
    expect(firstRow).toHaveAccessibleName(wizardEN.steps['1'].title);
  });
});
