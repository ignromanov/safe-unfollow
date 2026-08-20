import { Footer } from 'safe-unfollow';

// Footer takes no props — every visible string comes from i18n and the
// account count comes from the app's own Zustand store (which the preview
// runtime does not seed), so this single composition is the one real render:
// nav links, the "Don't Track Me" toggle, and the BuyMeACoffee card reading
// its zero-data copy ("No ads, no investors").
export function Default() {
  return <Footer />;
}
