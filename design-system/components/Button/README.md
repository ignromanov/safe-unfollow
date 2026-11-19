Action button with six variants and four sizes, from `src/components/ui/button.tsx` (shadcn new-york, cva).

Use `default` for the one primary action per view, `outline` or `ghost` for secondary actions, `destructive` only for irreversible actions, `link` for inline navigation. Labels are verbs in sentence case ("Export", "Not now").

The consumer provides the label (or an `aria-label` for `icon`), an `onClick` and, for navigation, `asChild` wrapping an anchor. Sizes: `default` 36px, `sm` 32px, `lg` 40px, `icon` 36px square, all `radius-md`. Text is 14px `body-medium`. Focus is a 3px `ring` outline at 80%; disabled is 50% opacity.

Colours: `default` is `primary` with `primary-foreground`; `link` uses `primary-strong`. On hover the fill moves (primary at 90%, `accent` for outline and ghost) and the label keeps `foreground`. Do not put two `default` buttons side by side.

Static rendition: markup recreated from the source's class list, no behaviour.
