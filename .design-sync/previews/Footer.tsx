import { Footer } from 'safe-unfollow';

// Footer takes no props — every visible string comes from i18n, so this
// single composition is the one real render: nav links, the "Don't Track Me"
// toggle and the author attribution.
export function Default() {
  return <Footer />;
}
