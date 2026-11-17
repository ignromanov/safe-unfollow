Page footer, from `src/components/Footer.tsx`: logo and wordmark, a one-sentence description, a row of legal and docs links, copyright and licence, and a control to turn anonymous analytics off.

The consumer provides nothing; links go through the language-aware link component. Surface is `card` with a 1px top `border`. Wordmark is `display` 800 (30px, 48px from 1024px). Description is 16px medium, max 384px. Links are 12px, weight 900, uppercase, 0.1em tracking, hover to `primary-strong`; external links open in a new tab with a screen-reader-only "(opens in new tab)". The analytics control toggles between "Disable anonymous analytics" and the off state and reloads the page when turned back on.

Copy: keep the footer claim to what is true: the export is read on the device and stays there. Do not add "no tracking" or "no ads" wording, because analytics and ads exist and are disclosed.

Link colour is Tailwind zinc-400 (`#a1a1aa`), about 2.5:1 on `card`: below the 4.5:1 floor, kept exact from the source; prefer `muted-foreground` for new link rows. Description text is zinc-500 / zinc-400 (4.8:1 light).

Static rendition: no behaviour; the analytics toggle and the GitHub mark are omitted.
