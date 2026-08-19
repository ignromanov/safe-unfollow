import { ResultsSkeleton } from 'safe-unfollow';

// No props by design — see the component's own doc comment: it must stay
// text-free because /results is prerendered once per language, and its box
// sizes are pinned to AccountListSection's real layout, not to any data this
// preview could vary.
export function Default() {
  return <ResultsSkeleton />;
}
