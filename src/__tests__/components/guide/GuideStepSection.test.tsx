import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { GuideStepSection } from '@/components/guide/GuideStepSection';
import { GUIDE_STEPS } from '@/config/wizard-steps';

const PLAIN = GUIDE_STEPS[3]!; // id 4, no warning
const WARNING = GUIDE_STEPS[2]!; // id 3, the only step marked isWarning

describe('GuideStepSection', () => {
  it('renders a lazy image, not a video, while off-screen', () => {
    // The poster attribute on a <video> downloads as soon as the element
    // enters the DOM, regardless of preload="none" — so seven off-screen
    // <video poster> cost exactly what seven on-screen ones do. Measured over
    // public/wizard/ steps 2-8: 166 KB of posters alone.
    const { container } = render(<GuideStepSection step={PLAIN} isInView={false} />);

    expect(container.querySelector('video')).toBeNull();
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('mounts the video once the section is in view', () => {
    const { container } = render(<GuideStepSection step={PLAIN} isInView />);

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('preload', 'none');
  });

  it('renders the warning marker for a step marked isWarning, and nothing for one that is not', () => {
    // isWarning is the single owner of "this step is a warning" — no bundle
    // carries a ⚠️ literal any more. A test that could no longer fail (the
    // old ⚠️-stripping assertion, vacuous once the copy dropped the emoji) is
    // exactly the shape that kept a dead constant alive through GH#34.
    const { unmount } = render(<GuideStepSection step={WARNING} isInView={false} />);
    expect(screen.getByText(wizardEN.format.warning, { exact: false })).toBeInTheDocument();
    unmount();

    render(<GuideStepSection step={PLAIN} isInView={false} />);
    expect(screen.queryByText(wizardEN.format.warning, { exact: false })).toBeNull();
  });

  it('anchors itself so the dialog can scroll to it', () => {
    // The `guide-step-` prefix is the contract GuideDialog queries, so it
    // stays a literal here; the number is interpolated because this test does
    // not care which step it renders, and hardcoding one silently coupled it
    // to whichever step happened to be the warning.
    const { container } = render(<GuideStepSection step={PLAIN} isInView={false} />);

    expect(container.querySelector(`#guide-step-${PLAIN.id}`)).not.toBeNull();
  });

  it('gives its heading a programmatic focus target', () => {
    // Not in the tab order (-1) — a deep link or rail tap focuses it directly,
    // so the viewport and focus agree on where the reader landed.
    render(<GuideStepSection step={PLAIN} isInView={false} />);

    expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute('tabindex', '-1');
  });
});
