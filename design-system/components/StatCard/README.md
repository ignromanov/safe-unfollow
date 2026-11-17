Tappable count tile that doubles as a filter toggle on `/results`, from `src/components/StatCard.tsx`.

The consumer provides an `icon` (18px lucide), a `label`, a numeric `value`, a `colorClass` for the resting icon tint, the `badgeType` it filters, `isActive` and `onClick`. The value is formatted with the user's locale. It renders a button with `aria-pressed`; without a `badgeType` it is disabled.

Rest: `card` surface, 1px `border`, 24px corners, padding 20px (24px from 768px), icon in a 10px-padded `radius-xl` chip. Active: `primary` fill and border, white-20% icon chip, `primary-foreground` text, `shadow-lg` and a 1.02 scale (dropped on touch devices). Value is `display` 800 at 20px (30px from 768px); label is 12px, weight 900, uppercase, 0.1em tracking.

The resting label uses Tailwind zinc-400 (`#a1a1aa`), about 2.6:1 on `card`, below the 4.5:1 floor. Kept exact from the source; prefer `muted-foreground` for any new tile and treat this as a known defect.

Static rendition: no behaviour.
