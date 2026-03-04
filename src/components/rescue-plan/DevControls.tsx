import { Bug } from 'lucide-react';

import type { UserSegment } from '@/lib/rescue-plan';

/**
 * DEV-only controls for testing Rescue Plan Banner
 *
 * Shows a button to cycle through all severity/size combinations.
 * Only rendered in development mode (import.meta.env.DEV).
 */

interface DevControlsProps {
  segment: UserSegment;
  onCycle: () => void;
}

export function DevControls({ segment, onCycle }: DevControlsProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <button
      onClick={onCycle}
      className="absolute top-4 start-4 p-2 text-zinc-400 hover:text-primary transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 text-xs font-mono z-10"
      title="Cycle through severity/size combinations"
    >
      <Bug size={16} />
      <span className="hidden sm:inline">
        {segment.severity}_{segment.size}
      </span>
    </button>
  );
}
