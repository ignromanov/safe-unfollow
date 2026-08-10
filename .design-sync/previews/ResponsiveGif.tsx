import { ResponsiveGif } from 'safe-unfollow';

// Real usage: Wizard step visuals (src/config/wizard-steps.ts). Video sources
// won't resolve in this static preview (no built /wizard/*.webm assets), so
// the box below renders the bordered video frame with its reserved 4:3 area
// rather than a playing clip — that reserved-box behavior is itself part of
// what this component guarantees (width/height set to avoid CLS).
export function WizardStepVisual() {
  return (
    <div className="max-w-sm overflow-hidden rounded-2xl border border-border">
      <ResponsiveGif
        basePath="/wizard/step-1"
        alt="Opening Instagram settings to request your data download"
      />
    </div>
  );
}
