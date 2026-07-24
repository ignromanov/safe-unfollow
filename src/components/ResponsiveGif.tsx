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
}

export function ResponsiveGif({
  basePath,
  alt,
  className = 'w-full h-auto block',
}: ResponsiveGifProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <img
        src={`${basePath}-600w-poster.jpg`}
        alt={alt}
        width={600}
        height={450}
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
      poster={`${basePath}-600w-poster.jpg`}
      width={600}
      height={450}
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
