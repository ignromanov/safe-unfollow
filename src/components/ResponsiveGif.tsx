/**
 * ResponsiveGif component
 * Serves optimized looping video (webm/mp4) sized for device viewport
 * - 400w for mobile (≤640px) - 69% smaller
 * - 600w for desktop (>640px) - 40% smaller
 * Respects prefers-reduced-motion by rendering a static poster instead of autoplaying.
 */

import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ResponsiveGifProps {
  /** Base path without size suffix (e.g., '/wizard/step-1') */
  basePath: string;
  /** Alt text for accessibility */
  alt: string;
  /** CSS class name */
  className?: string;
  /**
   * False while the clip is off-screen. Defaults to true, so every existing
   * caller keeps the behaviour it had.
   */
  isActive?: boolean;
  /**
   * Intrinsic size of the poster/video, so the browser reserves the right
   * box before either loads. Defaults to 600x450 (4:3) — every existing
   * caller's asset except the guide's first section, which is 600x360.
   */
  width?: number;
  height?: number;
}

export function ResponsiveGif({
  basePath,
  alt,
  className = 'w-full h-auto block',
  isActive = true,
  width = 600,
  height = 450,
}: ResponsiveGifProps) {
  const prefersReducedMotion = useReducedMotion();

  // Two reasons to show a still image, one branch. `isActive=false` is the
  // off-screen case, and it is not an optimisation of the video path but a
  // replacement of it: the `poster` attribute downloads as soon as the
  // <video> enters the DOM, regardless of preload="none", so an off-screen
  // <video poster> costs exactly what an on-screen one does. A plain
  // <img loading="lazy"> is the only thing that actually defers.
  //
  // ⚠️ The poster is 600w on both breakpoints (below, and in the video's own
  // `poster`), so a 390px phone downloads a 600-wide still for a 400-wide
  // clip. Pre-existing; seven sections in one scroll multiply it by seven.
  if (prefersReducedMotion || !isActive) {
    return (
      <img
        src={`${basePath}-600w-poster.jpg`}
        alt={alt}
        width={width}
        height={height}
        loading={isActive ? undefined : 'lazy'}
        className={className}
      />
    );
  }

  return (
    <video
      // Force a remount when the clip changes: browsers evaluate <source>
      // children only once, when the element is inserted into the DOM.
      key={basePath}
      autoPlay
      muted
      loop
      playsInline
      // Autoplay overrides this in every browser that implements both — the
      // element still loads. It is here for the browsers that treat a muted
      // autoplaying video as skippable until it is on screen, which is the
      // only case where it changes anything.
      preload="none"
      poster={`${basePath}-600w-poster.jpg`}
      width={width}
      height={height}
      className={className}
      aria-label={alt}
    >
      {/* Mobile: 400×300 for screens ≤640px */}
      <source media="(max-width: 640px)" src={`${basePath}-400w.webm`} type="video/webm" />
      <source media="(max-width: 640px)" src={`${basePath}-400w.mp4`} type="video/mp4" />

      {/* Desktop/Tablet: 600×450 for screens >640px */}
      <source media="(min-width: 641px)" src={`${basePath}-600w.webm`} type="video/webm" />
      <source media="(min-width: 641px)" src={`${basePath}-600w.mp4`} type="video/mp4" />
    </video>
  );
}
