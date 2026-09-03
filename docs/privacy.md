---
layout: default
title: Privacy Policy — Your Data Never Leaves Your Device
description: Where to read the Instagram Unfollow Tracker privacy policy, and the short version — your Instagram export is processed in your browser and never uploaded.
permalink: /privacy/
last_updated: 2026-08-09
---

# Privacy Policy

**The full, current policy lives at [safeunfollow.app/privacy](https://safeunfollow.app/privacy).**
That page is the only one we maintain, and it is the one to read before deciding whether to
trust this tool. This page exists so the documentation has a Privacy entry; it deliberately
does not restate the policy, because a second copy is a second thing to keep true.

## The short version

**Your Instagram export never leaves your browser.** The ZIP is opened, parsed and stored
locally in IndexedDB. There is no account, no Instagram login, and no server that receives
your Instagram export — which is also why nothing on this page, advertising included, can be
targeting it.

That claim is about *your Instagram data*, and only about it. The site itself does talk to a
handful of third parties, and the canonical policy names what each one receives:

| Who | What they get | Where |
|-----|---------------|-------|
| Vercel | standard web server logs (IP, timestamp, requested URL) | every page |
| Umami | anonymous page views and product events, no personal identifiers | every page |
| Google AdSense | ad requests and advertising cookies, subject to your consent choice | `/` and `/results` |
| Google (Funding Choices) | your consent choice, stored so the banner stops asking | consent regions |
| Affiliate networks | only what a link click sends, and only if you click | `/upload` |
| Dodo Payments | your licence key, your email if you buy the export, and — attached to the checkout link — whether you are on a phone or a big screen, the language you are reading in, and your country | export only |
| Tally | the feedback you type, plus your language, the page you sent it from and the site version — and only if you open the form | `/results`, on click |

Ads run on this site, and `/upload` carries one affiliate link. That is how the free analysis
is paid for. None of it touches the export, because the export is never uploaded anywhere.

## Verify rather than believe

- **Source code**: [github.com/ignromanov/safe-unfollow](https://github.com/ignromanov/safe-unfollow) — MIT, auditable
- **Network tab**: upload a file with DevTools open; no request carries its contents
- **Offline**: after the first load the analysis works with the network off

## Related

- **[Full Privacy Policy](https://safeunfollow.app/privacy)** — the canonical document
- **[Terms of Service](https://safeunfollow.app/terms)**
- **[Security policy](https://github.com/ignromanov/safe-unfollow/blob/main/SECURITY.md)** — for reporting vulnerabilities
