One row of the results list, from `src/components/AccountItem.tsx`; the whole row is a link to the profile on Instagram.

The consumer provides the `account` (username plus its badge flags), `index` and `totalCount` for `aria-posinset`, a date formatter and zones, and `reserveDateLine` so a dated file never changes row height while scrolling (virtualised lists need fixed heights). Handles are `display` bold, `translate="no"`, and truncate. Chips are 12px uppercase, weight 900, 0.05em tracking, `radius-lg`, one per active badge, coloured by the `rel-<badge>-fg`, `-bg` and `-border` tokens (eleven badges: following, followers, mutuals, notFollowingBack, notFollowedBack, unfollowed, pending, permanent, restricted, close, dismissed). Chip text clears 4.5:1 on both `card` and its own tint in both themes (source GH#211); margins are thin, so do not re-tint. Row padding is 16px by 20px on phones, 24px by 32px from 768px; hover tints with `accent`. Use only the synthetic demo usernames.

The avatar tile is Tailwind zinc-100 / zinc-800 with a zinc-400 icon: decorative, no meaning carried.

Static rendition: no behaviour.
