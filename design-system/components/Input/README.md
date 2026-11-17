Single-line text field, from `src/components/ui/input.tsx`; the account search uses it.

The consumer provides `type`, `value` or `defaultValue`, a placeholder and an accessible label (`aria-label` or a `<label>`). Height 48px, `radius` 16px (the source uses Tailwind `rounded-2xl`, larger than `radius-xl`), 1px `input` border, 16px text that drops to 14px from 768px. Placeholder is `muted-foreground`. Focus shows the `ring` border plus a 3px ring at 80%; `aria-invalid` switches border and a 20% ring to `destructive`. In dark the field fills with `input` at 30%.

Pair an invalid field with visible error text, not colour alone.

Static rendition: no behaviour.
