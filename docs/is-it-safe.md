---
layout: default
title: 'Is an Unfollowers Tracker Safe? What to Check First'
description: 'No login, no password. Your export stays in the browser, and the code that reads it is open source on GitHub.'
permalink: /is-it-safe/
last_updated: 2026-11-09
---

{% include faq-schema.html %}

# Is the unfollowers tracker legit?

It depends on one thing, and you can check it before you upload anything: **does it ask for your Instagram password?**

SafeUnfollow never asks. It reads the data export Instagram already gives you, on your own device. Every claim below carries the link that lets you check it — and the last section is the same check, written so you can run it on anyone.

## Why the password ones are the risky ones

A tracker you log into has to keep a password that works on your account, then use it to read your follower list as if it were you. Two things follow from that, and neither needs the tool to be dishonest:

- Giving your login to someone else is against [Instagram's Terms of Use](https://help.instagram.com/581066165581870). Read the clause yourself; it is two sentences.
- Instagram watches for logins that do not look like you. One from a server on another continent is exactly the kind that gets an account locked.

## The safe route already exists

Meta built it on purpose. You ask for your data, Meta sends you a ZIP, and a tool that reads that file needs no access to your account at all — no password to store, nothing to revoke, nothing to leak. [How to request the export](/docs/instagram-export) takes about four taps.

So a tracker is safe when three things are true at once: it never asks for your password, it reads only that export, and the file stays on your device.

## Is SafeUnfollow safe?

Five claims. Each one links to the thing that proves it.

1. **There is no password field.** Not on the upload page, not anywhere else — the product has no login at all. [Open the upload page](/upload?guide=1) and look.
2. **Your export is never sent to a server.** The ZIP is opened and searched on your device, and the results are stored there too. What the rest of the site loads is a separate question, answered on [the privacy page](/docs/privacy).
3. **You can read the code.** All of it, MIT licensed, [on GitHub](https://github.com/ignromanov/safe-unfollow) — including the part that opens your archive.
4. **These claims are checked automatically.** A test in that repository reads this very page and refuses to release a version where we have promised something sweeping about ads, servers or tracking.
5. **It is archived.** Every release is deposited on [Zenodo under one DOI](https://doi.org/10.5281/zenodo.22663615), so the code that read your file stays open to inspection even if this site goes away.

And the other direction, stated plainly, because a page like this is worth nothing if it only lists the flattering half: what *does* leave your browser is analytics and ad requests. Our analytics record page views and your export's account count and file size, never a username. Google ads load on the upload and results screens. Our code never sends the export to a server, so none of them receives your Instagram archive.

### The evidence for claim 2

| | |
|---|---|
| **Claim** | The export is never sent to a server. |
| **Method** | Open DevTools, then Network, then pick your export and watch. No request carries the file. |
| **Source** | The [open-source parser](https://github.com/ignromanov/safe-unfollow), which runs in a Web Worker in your browser, and [privacy policy](/privacy) §5. |
| **Date** | Checked 2026-11-09 |
| **Limitations** | Some pages load Google ads and analytics, which receive what any web request carries (IP address, browser, page URL). Our analytics also record your export's account count and file size, never a username. |

## What it costs, and where the catch would be

The analysis is free in full — every badge, every filter, every account, however large your following. No account, no subscription, no trial that ends. The one paid item is a one-time unlock for saving your list as CSV, JSON or an HTML report, and it costs $7 or less — the button shows your price.

Size is not the catch either. It is built and unit-tested for exports of a million accounts, and it was tested on a synthetic export of 1,000,000 accounts: about 21 seconds from choosing the file to results, in desktop Chrome (November 2026). That was one desktop run, and no phone has been tested at that size.

## What SafeUnfollow is not

- **Not live.** It reads the export you uploaded, so it shows your account as it stood the day Meta built that archive. Watching changes as they happen needs standing access to your account, which is the thing this whole approach avoids.
- **Not a way to look at anybody else.** Instagram gives the export only to you, so no tool of this kind can tell you who someone else unfollowed. If one claims it can, that is the claim to walk away from.
- **Not a browser extension.** SafeUnfollow is the web app at safeunfollow.app. Nothing we publish acts inside your Instagram session, or asks for your Instagram login. We do not publish a browser extension.

## How to check any tracker in two minutes

This is the list we would want you to run on us.

1. Does it ask for your Instagram password? If yes, you can stop here.
2. Can you reach its privacy policy from the page you are standing on, without going hunting?
3. Does that policy say the same thing as the front page, or does one of them promise more?
4. Does it name the other companies it uses, or only call them "trusted partners"?
5. Open your browser's network panel, load your file, and watch the list of requests. Your archive should appear in none of them.

Point five needs no trust in anybody, which is why it is the one worth doing.

Running it on a specific tool? [We compare SafeUnfollow with four trackers you are likely to meet in the same search results](/docs/compare) — prices and limits taken from their own pages, each with the date it was checked.

**[Run the check on us — open your export](/upload?guide=1)**

No account. Nothing to cancel. The file stays on this device.
