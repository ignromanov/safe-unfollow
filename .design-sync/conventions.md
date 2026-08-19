# Building with SafeUnfollow

A privacy-first Instagram relationship analyzer. Everything below is verified against this
bundle — token names, class names and props are real, not illustrative.

## Wrapping

Components read three contexts. Wrap once at the root; without them, themed components render
with the light palette's fallbacks, `useTranslation` returns raw keys like `results.title`, and
anything reaching for `<Link>` throws.

```jsx
const { ThemeProvider } = window.SafeUnfollow;

<I18nextProvider i18n={i18n}>
  {' '}
  {/* i18next, namespaces: common faq hero howto meta results upload wizard */}
  <MemoryRouter>
    {' '}
    {/* react-router — Header/Footer/Hero use <Link> */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </MemoryRouter>
</I18nextProvider>;
```

`ThemeProvider` is a pass-through to `next-themes`, so its full prop set applies —
`forcedTheme="light"` pins a screenshot, `enableSystem` gives the product's three-way
system → light → dark cycle.

## Styling idiom: Tailwind utilities over semantic tokens

There is no styling prop API. Style with Tailwind classes bound to these CSS custom
properties — **21 tokens, all defined in `styles.css`, all with a light and a dark value**:

| Group     | Tokens                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Surface   | `--background` `--foreground` `--card` `--card-foreground` `--popover` `--popover-foreground` `--muted` `--muted-foreground` |
| Brand     | `--primary` `--primary-foreground` `--secondary` `--secondary-foreground` `--accent` `--accent-foreground`                   |
| State     | `--destructive` `--destructive-foreground`                                                                                   |
| Structure | `--border` `--input` `--ring` `--radius` `--radius-xs`                                                                       |

So: `bg-card text-card-foreground border-border`, `bg-primary text-primary-foreground`,
`text-muted-foreground`, `ring-ring`. **Never `text-white` on `--primary` or `--accent`** — both
themes pair those with a near-black foreground token, and white fails WCAG AA against them.

Four custom utilities exist beyond stock Tailwind: **`.font-display`** (Plus Jakarta Sans, every
headline / stat number / username), **`.text-gradient`** (brand gradient clipped to text — one
highlighted phrase per headline, never a whole heading), **`.bg-gradient-brand`** (the logo tile
and upload well), **`.no-scrollbar`**. Body text is Inter; both families ship in `fonts/`.

Radius runs large: `rounded-2xl` buttons and chips, `rounded-3xl` stat cards, `rounded-4xl`
panels and the account list. Elevation is restrained — `shadow-sm` with a 1px border at rest,
`shadow-xl` on hover; the only heavy shadow is `shadow-2xl shadow-primary/30` on a primary CTA.

## Props that exist

`Button` takes `variant` (`default` `destructive` `outline` `secondary` `ghost` `link`),
`size` (`default` `sm` `lg` `icon`) and `asChild`. `Badge` takes a narrower `variant`
(`default` `destructive` `outline` `secondary`) plus `asChild` — note it has **no `ghost`,
`link` or `size`**, so a Button habit does not transfer. The eleven relationship colours are
not variants at all: they are applied with `className` as a 12% tint background, a 20% border
and the solid hue as text. Read each component's `.d.ts` before assuming a prop — the contracts
are generated from the shipped source, and the two components' variant sets differ.

## Where the truth lives

- `styles.css` and its `@import` closure — the only stylesheet a rendered design receives.
- `components/<group>/<Name>/<Name>.d.ts` — the API contract. `.prompt.md` beside it — usage.
- `DESIGN-GUIDE.md` — voice, colour rationale, the mobile contract, accessibility rules.

## Two product constraints that change what you build

**85% of traffic is mobile.** Base styles are the mobile case with no prefix; desktop rides on
`sm:`/`md:`/`lg:`. Touch targets ≥44px. Layouts go `flex-col sm:flex-row`, buttons
`w-full sm:w-auto`, secondary words drop with `hidden sm:inline` rather than truncate.

**No blanket denials in copy.** "No ads", "no tracking cookies", "no third-party requests" are
false as of 2026-07-27 and are banned by `src/__tests__/docs/monetization-claims.test.ts`. The
load-bearing claim is narrower and still true: _the Instagram export never leaves the browser_.

## An idiomatic composition

```jsx
const { Button, Badge } = window.SafeUnfollow;

<div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
  <h3 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
    Unfollowed you
  </h3>
  <p className="mt-1 text-sm text-muted-foreground">142 accounts since your last export.</p>
  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
    <Button className="w-full sm:w-auto">Review the list</Button>
    <Button variant="ghost" className="w-full sm:w-auto">
      Not now
    </Button>
  </div>
</div>;
```
