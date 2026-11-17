Small label for status and counts, from `src/components/ui/badge.tsx`.

Use `default`, `secondary`, `destructive` and `outline` for generic labels. For relationship status in account rows use the two soft pills: `badge-negative-bg` / `badge-negative-fg` for "Not following back" and `badge-info-bg` / `badge-info-fg` for "Following". The pills are a documented brand treatment (BRAND_IDENTITY.md), drawn here fully rounded; the shipped `Badge` primitive itself is `radius-md`. Always carry the word, never colour alone. Both pill pairs sit under 4.5:1 (3.95 and 4.24), so keep them at 12px semibold only inside a pill, never as running text.

The consumer provides the label as children; `asChild` turns it into a link. Type is 12px `caption`, padding 2px by 8px.

Static rendition: no behaviour.
