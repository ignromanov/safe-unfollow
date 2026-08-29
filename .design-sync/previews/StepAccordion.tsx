import { StepAccordion } from 'safe-unfollow';

// The disclosure at the foot of GuideEntry: one trigger over seven links to
// the guide sections 1..7 (once /wizard/step/2..8). Seven, not eight — step 1
// was the entry screen itself, and StepAccordion.tsx:21 filters it out. The count in the trigger label is
// derived from that filtered list rather than written down, so it stays true
// if a step is ever added or removed.
//
// Closed is the only state a static story can reach. `isOpen` is internal
// state with no prop and no default override (StepAccordion.tsx:33), and no
// preview in this project drives component state — rows stay unmounted until a
// real click, which is also why opening never shifts layout.
//
// That limit matters for the reviewer, not for the card: the open row's poster
// box is the one measurement the conversion-audit artboard specified without
// being able to see it (FunnelEntry.dc.html 1B — "poster 4:3 · 328x246"). The
// real sizes are per-step and live in the component: 600x450 for steps 3-8,
// 600x360 for step 2, because step 2's asset is 5:3 and forcing it to 4:3
// would crop or letterbox it (StepAccordion.tsx:9-17).
export function Closed() {
  return (
    <div className="max-w-lg">
      <StepAccordion />
    </div>
  );
}
