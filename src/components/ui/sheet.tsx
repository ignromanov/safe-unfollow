import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/utils';

/**
 * A bottom-anchored panel over `@radix-ui/react-dialog` — the same primitive
 * `dialog.tsx` wraps, so this adds no dependency.
 *
 * It exists rather than reusing `Dialog` because the option space is eleven
 * items in three sections: a centred, vertically-shrinking dialog puts them
 * where a thumb cannot reach, and 85% of this page's readers are on a phone.
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

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
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
      // The content is bottom-anchored and scrolls inside itself: the option
      // space is eleven items in three sections and must not push the page.
      className={cn(
        'fixed inset-x-0 bottom-0 z-[90] max-h-[85dvh] overflow-y-auto rounded-t-4xl border-t border-border bg-card p-5 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetClose, SheetContent, SheetTrigger };
