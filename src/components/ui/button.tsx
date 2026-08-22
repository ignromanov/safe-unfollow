import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/80 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        // The hover surface is overridden per theme (`dark:hover:bg-input/50`)
        // but the hover foreground was not, so `--accent-foreground` — a colour
        // chosen to sit on `--accent` — landed on near-black `--input` in dark
        // mode at 1.16:1. `--foreground` is legible on both hover surfaces
        // (17.51:1 light on flat accent, 16.52:1 dark on input/50 over a card),
        // i.e. hover changes the fill and leaves the label alone. The light
        // figure was 5.46:1 while `--accent` was the brand violet; it moved
        // when that token became a neutral, not because anything here changed.
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        // Same defect as `outline` — `--foreground` on both, so hover moves the
        // fill and not the ink.
        //
        // History: `--accent` was the brand violet, and `dark:hover:bg-accent/50`
        // over a dark page composited to #4d4684. On the paywall that made the
        // ghost "Not now" read as a second primary button at the moment the
        // cursor was on the decision — a hierarchy defect, not a contrast one;
        // it measured 7.88:1, better than the paid CTA's own 6.15:1. `--accent`
        // became the neutral its four consumers always used it as, and the
        // first attempt at that reused `--input`'s lightness (0.25) — which then
        // undershot the MD 8% hover-overlay floor as a flat surface (1.175:1 on
        // --card against a 1.2185 requirement) once the `/50` alpha that had
        // been softening it was still applied on top. `--accent` is now 0.28,
        // clearing that floor on both --background and --card
        // (accent-contrast.test.ts), and the `/50` override is dropped here:
        // the alpha existed only to tame the violet, and against a neutral
        // token it was the thing pushing the hover under the visibility floor.
        // Dropping it also means ghost hovers to flat `--accent` in both
        // themes, same as the light side already did.
        ghost: 'hover:bg-accent hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
