Bottom sheet on phones that becomes a centred dialog from 640px, from `src/components/ui/sheet.tsx`; the filter drawer and export options use it.

The consumer provides a title, scrollable content and an open state. Below 640px: anchored to the bottom, full width, `card` surface, 32px top corners, one top border, at most 85% of the dynamic viewport height, with bottom padding that adds the iOS safe-area inset so the last row clears the home indicator. From 640px: centred, max 512px, `radius-lg`, full border. The header row is sticky with an opaque `card` background so scrolled rows never show under the title or close button; the close control is 44px, round, at 70% opacity. Scrim and content are z-index 90, same as `Dialog`.

Design for the phone first: 85% of the results traffic is mobile.

Static rendition: shown at 390px; no gestures or animation.
