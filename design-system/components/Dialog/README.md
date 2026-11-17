Modal dialog (Radix Dialog), from `src/components/ui/dialog.tsx`: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`.

The consumer provides a title, a short description and the footer actions; every dialog needs a title for screen readers. Content is `background` with a 1px `border`, `radius-lg`, 24px padding, 16px gaps, a large shadow, at most 512px wide and 16px from the viewport edges. The scrim is black at 50%. Both sit at z-index 90: above the sticky header (80), below dropdown menus (100). Title is 18px semibold; description is `muted-foreground`. The close button sits at the inline end (44px target on touch) and can be hidden with `showCloseButton={false}`. Footer stacks on phones and right-aligns from 640px, primary action last; use `destructive` for irreversible confirmations.

Static rendition: no focus trap or animation.
