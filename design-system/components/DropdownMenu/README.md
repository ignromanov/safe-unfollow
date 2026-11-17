Popup menu (Radix Dropdown Menu), from `src/components/ui/dropdown-menu.tsx`; the language switcher uses it.

The consumer provides a trigger, items (plain, checkbox or radio) and handlers; use radio items for a single choice such as language. The panel is white (zinc-900 in dark) with a 1px `border`, 16px corners, 4px padding and a large shadow; items are 14px with 8px by 12px padding and 12px corners, and the focused item shows zinc-100 (zinc-800 in dark). Checked items show a 16px check at the inline start, and `ps-8` inset keeps labels aligned (this mirrors in RTL). The panel sits at z-index 100, above dialogs (90).

The menu surface and focus colours are Tailwind zinc values written in the source, not tokens; text is near-black on white (about 19:1).

Static rendition: no keyboard or positioning behaviour.
