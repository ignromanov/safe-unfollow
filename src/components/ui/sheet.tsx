import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

/**
 * A bottom-anchored panel over `@radix-ui/react-dialog` — the same primitive
 * `dialog.tsx` wraps, so this adds no dependency.
 *
 * It exists rather than reusing `Dialog` because the option space is eleven
 * items in three sections: a centred, vertically-shrinking dialog puts them
 * where a thumb cannot reach, and 85% of this page's readers are on a phone.
 *
 * Below `sm` it is exactly that: a bottom sheet, full width, welded to the
 * bottom edge. At `sm` and up it is the same centred, width-capped dialog
 * every other Radix dialog in this app uses (`dialog.tsx`) — `/results`
 * would otherwise carry two bottom sheets on the same primitive with
 * opposite breakpoint policies once `ExportSheet` and this one are both on
 * screen. `ExportSheet.tsx:46` is the sibling this idiom is copied from.
 */

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="sheet-title"
    className={cn('text-lg leading-snug font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="sheet-description"
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

type SheetContentBaseProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

/**
 * `title` renders visibly in the sticky header row (finding 5, below). A
 * caller that only has an `aria-label` — the current `/results` caller,
 * `AccountListSection.tsx` — gets a sr-only `SheetTitle` built from that
 * string instead: a real Radix `Title` descendant wires `aria-labelledby`
 * automatically (fixing the "DialogContent requires a DialogTitle" warning
 * and the AT/browser pairs that prefer an element over the attribute), and
 * nothing changes on screen until the caller migrates to `title` — so this
 * does not add the second rendered `filters.title` that would violate "one
 * title, one Reset control on the shipped surface".
 *
 * The union — not a plain optional `title` — is what makes "cannot render a
 * sheet with an empty header band" a compile error rather than a hope: a
 * caller must supply one of the two, or TypeScript refuses it.
 */
type SheetContentProps = SheetContentBaseProps &
  ({ title: React.ReactNode } | { title?: never; 'aria-label': string });

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, title, ...props }, ref) => {
  const { t } = useTranslation('common');
  const ariaLabel = typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined;

  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        // z-[90], not the z-50 a stock shadcn sheet ships with. Header.tsx is
        // z-[80]: at z-50 the app header would paint over a scrim whose dialog
        // holds focus, leaving clickable buttons above a modal surface. The
        // reasoning and the two neighbours (header z-[80], dropdown z-[100]) are
        // stated once, on DialogOverlay in `dialog.tsx`.
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[90] bg-black/50"
      />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        // The content is its own scroll container. `p-5` is the same value
        // at every breakpoint on purpose: the sticky header below undoes and
        // reapplies exactly this padding (`-mx-5 -mt-5 … px-5 pt-5`), and a
        // padding that forked by breakpoint would force that arithmetic to
        // fork with it for no reason this component needs.
        className={cn(
          'fixed z-[90] max-h-[85dvh] overflow-y-auto border-border bg-card p-5 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          // Below `sm`: bottom-anchored, full width, one border on top only —
          // the option space is eleven items in three sections and 85% of
          // this page's readers are on a phone. The safe-area padding is
          // `ExportSheet.tsx:46`'s own fix for the same finding: at a flat
          // `pb-5` the sheet's last row sat under the iOS home-indicator's
          // swipe-up area (34px) with only 20px to spare.
          'max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-4xl max-sm:border-t max-sm:pb-[calc(1.75rem+env(safe-area-inset-bottom))] max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom',
          // `sm` and up: the same centred, width-capped dialog every other
          // Radix dialog in this app uses (`dialog.tsx`'s `DialogContent`) —
          // a bottom sheet on a screen with room for a centred card is the
          // surprise, not the norm, and this page will carry two sheets on
          // the same primitive once `ExportSheet` is also present.
          'sm:top-[50%] sm:left-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      >
        {/* Sticky header row, not a bare sticky close control. `SheetClose`
            alone had a transparent background: scrolled content showed
            through and under it, hiding an option's own label and eating a
            tap meant for that option (finding 1). Giving the *row* the
            content box's own opaque surface (`bg-card`) and full width fixes
            both at once, and gives the title (finding 5) somewhere to sit
            that survives scrolling too.

            `sticky`, not `absolute` — the content box is its own scroll
            container: an absolute row scrolls out of reach on the way down. */}
        <div
          data-slot="sheet-header"
          className="sticky top-0 z-10 -mx-5 -mt-5 mb-1 flex items-center justify-between gap-3 bg-card px-5 pt-5 pb-3"
        >
          <SheetTitle className={title ? undefined : 'sr-only'}>{title ?? ariaLabel}</SheetTitle>
          {/* size-11 (44px) and the WCAG 2.5.5 rationale are `dialog.tsx`'s
              convention, stated there — every other dialog in this app has
              this control, and a sheet that quietly differs is the surprise. */}
          <SheetClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <XIcon />
            <span className="sr-only">{t('buttons.close', { defaultValue: 'Close' })}</span>
          </SheetClose>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
