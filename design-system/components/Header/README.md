Sticky top bar, from `src/components/Header.tsx`: logo and wordmark at the inline start; an upload link (no data) or results link plus delete (with data); a divider, the language switcher and the theme toggle.

The consumer provides `hasData`, `onClear` and `activeScreen`. The bar is `card` with a 1px bottom `border`, 64px high (80px from 768px), sticky at z-index 80, with a blurred 80% `card` from 768px. Wordmark is `display` 800 ("SafeUnfollow" in `foreground`, ".app" in `primary-strong`), hidden below 640px so only the logo shows. Action links are 12px bold (14px from 768px), `radius-xl`, with an 18px icon and the label only from 768px, so every icon-only control needs an `aria-label`. The active screen link is a `primary` fill. Delete is rose-500 and opens an alert dialog. Theme cycles system, light, dark.

Inactive link and icon colour is Tailwind zinc-500 (`#71717a`), about 4.8:1 on `card`; the rose delete label is about 3.3:1 and is kept exact.

Static rendition: language list and theme icons simplified (a moon stands in for the system/light/dark icon).
