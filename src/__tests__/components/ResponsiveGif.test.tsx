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

  it('remounts the video element when basePath changes so the browser re-selects sources', () => {
    mockMatchMedia(false);

    const { container, rerender } = render(
      <ResponsiveGif basePath="/wizard/step-1" alt="Step 1" />
    );
    const firstVideo = container.querySelector('video');

    rerender(<ResponsiveGif basePath="/wizard/step-2" alt="Step 2" />);
    const secondVideo = container.querySelector('video');

    // Browsers only evaluate <source> children when the <video> is inserted;
    // updating src on a live element is ignored, so a new node is required.
    expect(secondVideo).not.toBe(firstVideo);
    expect(secondVideo).toHaveAttribute('poster', '/wizard/step-2-600w-poster.jpg');
  });

  it('renders a static poster image when prefers-reduced-motion matches', () => {
    mockMatchMedia(true);

    render(<ResponsiveGif basePath="/wizard/step-1" alt="Step 1" />);

    expect(screen.getByAltText('Step 1')).toHaveAttribute('src', '/wizard/step-1-600w-poster.jpg');
    expect(screen.queryByRole('img')).toBeInTheDocument();
  });
});
