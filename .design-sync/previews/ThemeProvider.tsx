import { ThemeProvider } from 'safe-unfollow';

// ThemeProvider is a pass-through to next-themes: it renders `children` and nothing else,
// so a preview of the component alone measures 0px tall. What it actually delivers is the
// token palette every other component resolves against, and that is what these cards show.
//
// Side-by-side light/dark is NOT achievable here: next-themes writes the theme onto
// <html>, not onto the provider's own subtree, so two nested providers with different
// `forcedTheme` values would still paint one theme. Use the design tool's own theme
// switch to see the other side.

const SWATCHES = [
  { token: 'bg-background', label: 'background' },
  { token: 'bg-card', label: 'card' },
  { token: 'bg-primary', label: 'primary' },
  { token: 'bg-accent', label: 'accent' },
  { token: 'bg-muted', label: 'muted' },
  { token: 'bg-destructive', label: 'destructive' },
];

export function TokensInScope() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
        <p className="font-display font-bold text-lg mb-1">Everything below resolves tokens</p>
        <p className="text-muted-foreground text-sm mb-5">
          Wrap the tree once, near the root. Components read the palette from CSS variables — they
          never take a theme prop.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {SWATCHES.map(s => (
            <div key={s.token}>
              <div className={`${s.token} h-12 rounded-lg border border-border`} />
              <p className="text-muted-foreground text-xs mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </ThemeProvider>
  );
}

export function PassThrough() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
        <p className="font-display font-bold text-lg mb-1">It adds no markup</p>
        <p className="text-muted-foreground text-sm">
          The provider emits no wrapper element of its own, so it never affects layout — drop it
          around an existing tree without touching the tree.
        </p>
      </div>
    </ThemeProvider>
  );
}
