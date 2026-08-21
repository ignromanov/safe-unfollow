const { useState, useEffect, useRef, useMemo } = React;

function Icon({ name, size = 20, className = '', strokeWidth = 2, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.lucide) return;
    ref.current.innerHTML = '';
    const el = document.createElement('i');
    el.setAttribute('data-lucide', name);
    ref.current.appendChild(el);
    window.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': strokeWidth } });
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={className} style={{ display: 'inline-flex', flexShrink: 0, ...style }} />;
}

const BADGE_STYLES = {
  following: 'bg-[oklch(0.6_0.15_250_/_0.12)] text-[oklch(0.6_0.15_250)] border-[oklch(0.6_0.15_250_/_0.2)]',
  followers: 'bg-[oklch(0.7_0.15_150_/_0.12)] text-[oklch(0.6_0.18_150)] border-[oklch(0.7_0.15_150_/_0.2)]',
  mutuals: 'bg-[oklch(0.6_0.18_264_/_0.12)] text-[oklch(0.6_0.18_264)] border-[oklch(0.6_0.18_264_/_0.2)]',
  notFollowingBack: 'bg-[oklch(0.6_0.2_25_/_0.12)] text-[oklch(0.6_0.2_25)] border-[oklch(0.6_0.2_25_/_0.2)]',
  notFollowedBack: 'bg-[oklch(0.75_0.15_80_/_0.12)] text-[oklch(0.7_0.18_80)] border-[oklch(0.75_0.15_80_/_0.2)]',
  unfollowed: 'bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.55_0.25_25)] border-[oklch(0.6_0.22_25_/_0.3)] font-bold',
  pending: 'bg-[oklch(0.7_0.15_50_/_0.12)] text-[oklch(0.65_0.18_50)] border-[oklch(0.7_0.15_50_/_0.2)]',
  permanent: 'bg-[oklch(0.55_0.2_25_/_0.12)] text-[oklch(0.55_0.2_25)] border-[oklch(0.55_0.2_25_/_0.2)]',
  restricted: 'bg-[oklch(0.5_0_0_/_0.12)] text-[oklch(0.4_0_0)] border-[oklch(0.5_0_0_/_0.2)]',
  close: 'bg-[oklch(0.65_0.2_340_/_0.12)] text-[oklch(0.65_0.2_340)] border-[oklch(0.65_0.2_340_/_0.2)]',
  dismissed: 'bg-[oklch(0.5_0.05_250_/_0.12)] text-[oklch(0.5_0.05_250)] border-[oklch(0.5_0.05_250_/_0.2)]',
};

const BADGE_LABELS = {
  followers: 'Followers', following: 'Following', unfollowed: 'Recently unfollowed',
  notFollowingBack: 'Not following back', mutuals: 'Mutuals', notFollowedBack: 'Not followed back',
  pending: 'Pending request', permanent: 'Pending (permanent)', restricted: 'Restricted',
  close: 'Close friend', dismissed: 'Dismissed suggestion',
};

const BADGE_ICONS = {
  following: ['users', 'text-blue-500'], followers: ['user-plus', 'text-emerald-500'],
  mutuals: ['heart', 'text-indigo-500'], notFollowingBack: ['trending-down', 'text-rose-500'],
  notFollowedBack: ['ghost', 'text-amber-500'], unfollowed: ['circle-x', 'text-rose-600'],
  pending: ['clock', 'text-amber-400'], permanent: ['clock', 'text-zinc-500'],
  restricted: ['circle-alert', 'text-zinc-400'], close: ['heart', 'text-pink-500'],
  dismissed: ['circle-x', 'text-zinc-400'],
};

const NAMES = ['traveler_anna', 'mark.builds', 'studio.nord', 'kate_ceramics', 'oliver.runs', 'the.slow.kitchen', 'j_martinez', 'nordic.film', 'rae.writes', 'atlas.workshop', 'mina_draws', 'coldbrew.club'];
const BADGE_SETS = [
  ['followers', 'following', 'mutuals'], ['following', 'notFollowingBack'], ['followers', 'notFollowedBack'],
  ['followers', 'following', 'mutuals', 'close'], ['unfollowed'], ['following', 'pending'],
  ['followers', 'following', 'mutuals'], ['following', 'notFollowingBack'], ['followers', 'notFollowedBack'],
  ['unfollowed', 'notFollowingBack'], ['followers', 'following', 'mutuals'], ['following', 'restricted'],
];
const ACCOUNTS = NAMES.map((username, i) => ({ username, badges: BADGE_SETS[i] }));

const COUNTS = { followers: 4820, following: 3110, unfollowed: 47, notFollowingBack: 612, mutuals: 2498, notFollowedBack: 2322, pending: 18, permanent: 0, restricted: 3, close: 26, dismissed: 0 };

Object.assign(window, { Icon, BADGE_STYLES, BADGE_LABELS, BADGE_ICONS, ACCOUNTS, COUNTS });
