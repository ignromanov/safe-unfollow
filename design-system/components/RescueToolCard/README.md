Affiliate tool card inside the Rescue Plan banner on `/results`, from `src/components/rescue-plan/RescueToolCard.tsx`. This is a monetized surface.

The consumer provides a `tool` (url, name, icon, tint class, badge, and the price, social-proof and description copy keys), its `index` and a click handler that records the click. The card is a link opening in a new tab with `rel="noopener noreferrer"`. Layout: 16px padding, 16px corners, 2px border, icon and name, a price line in emerald plus a grey social-proof line, a two-line description, and a full-width CTA "Get My <name> Trial" pinned to the bottom. The first card is "Recommended": a `primary` label at the inline start, darker border, a `primary` CTA fill and a hover ring. Others get a grey CTA that turns `primary` on hover. An optional badge (Popular orange, Trial emerald, New blue) sits at the top inline end.

The banner must carry the disclosure "Hand-picked tools we recommend. Affiliate links fund free updates, no cost to you." Never claim results as measured. The source prefixes badge labels with emoji; this system shows the text only, since emoji are not used as decoration.

Known contrast gaps kept from the source: white on orange-500 for "Popular" is about 2.8:1, and the social-proof grey (`#a1a1aa`) is about 2.5:1 on white.

Static rendition: two of the six tools; icons are a generic calendar glyph, not the per-tool icons.
