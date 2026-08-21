import { GuideEntry } from 'safe-unfollow';

// The screen a reader reaches from the hero's "get the guide" CTA — the
// wizard's step 1 (Wizard.tsx:166), and the one screen this project has never
// carried a card for. `Wizard` itself is parked as previews/Wizard.tsx.blocked
// because `fixed inset-0` collapses under the capture wrapper; GuideEntry is an
// ordinary `max-w-xl` card, so that cause does not apply to it. NOTES.md 2a
// names authoring this file as the way to give the guide a representation
// without faking the wizard shell or forking the harness.
//
// What this card cannot show, and what a reviewer must not assume it does: the
// chrome the screen ships inside. The step dots, the close control and the
// pinned bottom bar all belong to Wizard, and on this screen alone that bar's
// two slots swap label and destination once the in-flow CTA scrolls out of
// view (Wizard.tsx:86). This is the content, not the frame — which is exactly
// the mistake the conversion-audit artboard made in the other direction.
//
// `ctaRef` is omitted deliberately: its only consumer is the wizard's
// IntersectionObserver, and a static card has no scroll to observe.
export function Default() {
  return <GuideEntry />;
}
