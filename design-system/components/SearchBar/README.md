Search field for the account list, from `src/components/SearchBar.tsx`. It wraps `Input` with a leading magnifier, a clear button and a result count line.

The consumer provides `value`, `onChange`, `resultCount`, `totalCount`, and optionally `isFiltering` (the icon becomes a spinner) and `processingTime` in ms. Height is 48px on phones and 40px from 640px; icon and clear button sit at the inline start and end so Arabic mirrors. The clear target is 44px on touch. Below the field a 12px `muted-foreground` line gives "N of M accounts" and, when known, the time. A polite live region announces the result count to screen readers.

Static rendition: no filtering behaviour.
