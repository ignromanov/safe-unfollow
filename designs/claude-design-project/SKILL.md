---
name: safeunfollow-design
description: Use this skill to generate well-branded interfaces and assets for SafeUnfollow, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read `DESIGN-GUIDE.md` first — it holds the product context, voice, visual foundations and
iconography rules. Then `README.md` for the generated component and token inventory, and
`ui_kits/app/index.html` for how a real screen is assembled.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and
create static HTML files for the user to view: link `styles.css` and `_ds_bundle.js`, then use
`window.SafeUnfollow.*`. If working on production code, you can copy assets and read the rules
here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or
design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_
production code, depending on the need.
