The shell every export screen sits in, from `src/components/export/ExportSheet.tsx`: a Radix Dialog that turns into a bottom sheet below 640px.

From 640px it is the ordinary `Dialog`: centred, `radius-lg`, at most 512px. Below 640px it sticks to the bottom edge: 24px top corners, 20px side padding, 28px bottom padding plus the safe-area inset, no bottom border, a soft upward shadow, at most 90dvh tall and scrollable, sliding up from the bottom. A 36×4px grabber in `border` sits 8px from the top edge on phones only. The close button is shown by default and hidden with `showCloseButton={false}` (the paywall does this: its way out is "Not now").

Use it for every step of the paid flow so the person never sees one screen replace another by jumping. The consumer provides a `DialogTitle` and `DialogDescription` in the children; screen readers need both.

Static rendition: no focus trap, animation or scroll lock.
