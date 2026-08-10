import { HowToSection } from 'safe-unfollow';

// onStart is an optional override for step navigation; it changes click behavior,
// not appearance, so there is no visual variant axis to split into a second card.
export function Default() {
  return <HowToSection />;
}
