import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { StepAccordion } from '@/components/wizard/StepAccordion';

describe('StepAccordion', () => {
  it('is closed on first paint and holds no video', () => {
    const { container } = render(<StepAccordion />);

    expect(container.querySelector('video')).toBeNull();
    // Closed rows are not mounted, so "not reachable" is the correct assertion
    // form here — see task-3 controller ruling 2 (toBeVisible() throws on null).
    expect(screen.queryByRole('link', { name: /step 2/i })).not.toBeInTheDocument();
  });

  it('opens to seven real links, one per remaining step', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/wizard/step/2'));
  });

  it('reserves each poster box before the image loads', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    const poster = screen.getAllByRole('img')[0];
    expect(poster).toHaveAttribute('loading', 'lazy');
    expect(poster).toHaveAttribute('width');
    expect(poster).toHaveAttribute('height');
  });

  it("reserves step 2's poster box from its own 5:3 intrinsic size, not the 4:3 default", async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    const [step2Poster, step3Poster] = screen.getAllByRole('img');
    expect(step2Poster).toHaveAttribute('width', '600');
    expect(step2Poster).toHaveAttribute('height', '360');
    expect(step3Poster).toHaveAttribute('width', '600');
    expect(step3Poster).toHaveAttribute('height', '450');
  });

  it('toggles closed again on a second click', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);
    const trigger = screen.getByRole('button', { name: /step-by-step/i });

    await user.click(trigger);
    expect(screen.getAllByRole('link')).toHaveLength(7);

    await user.click(trigger);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('prefixes step links with the current language', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />, { initialEntries: ['/id'] });

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/id/wizard/step/2')
    );
  });

  it('never mixes native details/summary markers with RTL', () => {
    const { container } = render(<StepAccordion />);

    // If a <details> element is used anywhere, its default marker must be
    // replaced — the native marker does not mirror under RTL (task-3 brief).
    container.querySelectorAll('summary').forEach(summary => {
      expect(summary).toHaveClass('list-none');
    });
  });

  it('labels the whole row so the row text names a real step', async () => {
    const user = userEvent.setup();
    render(<StepAccordion />);

    await user.click(screen.getByRole('button', { name: /step-by-step/i }));

    const firstRow = screen.getAllByRole('link')[0];
    expect(within(firstRow).getByText(wizardEN.steps['2'].title)).toBeInTheDocument();
  });
});
