import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { GuideStepSection } from '@/components/guide/GuideStepSection';
import { GUIDE_STEPS } from '@/config/wizard-steps';

const PLAIN = GUIDE_STEPS[3]!; // id 4, no warning
const WARNING = GUIDE_STEPS[2]!; // id 3, the "Followers and following" step

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

  it('strips the warning prefix from the heading', () => {
    // The amber card and the amber number already carry the signal here —
    // three carriers of one message. The string itself keeps the prefix,
    // because StepAccordion's row on /upload is a plain row with no amber at
    // all, and that is the surface where a scanning reader decides what to
    // read.
    render(<GuideStepSection step={WARNING} isInView={false} />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).not.toContain('⚠️');
    expect(heading.textContent).toContain('Followers and following');
  });

  it('anchors itself so the dialog can scroll to it', () => {
    const { container } = render(<GuideStepSection step={WARNING} isInView={false} />);

    expect(container.querySelector('#guide-step-3')).not.toBeNull();
  });
});
