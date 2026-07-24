import { ResponsiveGif } from '@/components/ResponsiveGif';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe('ResponsiveGif', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders an autoplaying video when motion is not reduced', () => {
    mockMatchMedia(false);

    const { container } = render(<ResponsiveGif basePath="/wizard/step-1" alt="Step 1" />);

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('poster', '/wizard/step-1-600w-poster.jpg');
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders a static poster image when prefers-reduced-motion matches', () => {
    mockMatchMedia(true);

    render(<ResponsiveGif basePath="/wizard/step-1" alt="Step 1" />);

    expect(screen.getByAltText('Step 1')).toHaveAttribute('src', '/wizard/step-1-600w-poster.jpg');
    expect(screen.queryByRole('img')).toBeInTheDocument();
  });
});
