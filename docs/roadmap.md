---
layout: default
title: "Instagram Unfollow Tracker Roadmap: Planned Features"
description: 'See what''s coming next for Instagram Unfollow Tracker. Historical comparison, CSV export, Chrome extension, and more planned features.'
permalink: /roadmap/
last_updated: 2026-09-03
---

# Roadmap

## Current Status (v1.5.0) ✅

**Released:** January 14, 2026

### Core Functionality
- ✅ **Unfollow tracking** — Find who unfollowed you and who you don't follow back
- ✅ **Smart badges** — Following, Followers, Mutuals, Not following back, Not followed back, Pending, Restricted, Close friends, Unfollowed, Dismissed
- ✅ **Lightning search** — Trigram/prefix indexes, designed for sub-2ms search even at 1M+ accounts
- ✅ **Advanced filtering** — BitSet-based filtering designed to stay interactive for any badge combination
- ✅ **Direct profile links** — Click to open Instagram profiles in new tabs

### User Experience
- ✅ **Modern UI** — shadcn/ui components with Tailwind CSS and OKLCH colors
- ✅ **Drag & drop upload** — Easy ZIP file upload with visual feedback
- ✅ **Responsive design** — Works on desktop, tablet, and mobile (85% of visits are mobile)
- ✅ **3-way theme toggle** — Light / Dark / System with OS preference detection
- ✅ **Accessibility** — ARIA labels, keyboard navigation, screen reader support, skip links
- ✅ **Error recovery** — ErrorBoundary with graceful error handling and recovery UI

### Internationalization (i18n)
- ✅ **10 languages** — English, Spanish, Russian, German, Portuguese, Turkish, Indonesian, Japanese, Arabic, French
- ✅ **Arabic RTL support** — Full right-to-left layout for Arabic
- ✅ **Pre-rendered pages** — every route, in every language, built ahead of time with vite-react-ssg for instant load
- ✅ **Localized meta tags** — Dynamic title/description per language for SEO
- ✅ **Browser language detection** — Auto-redirects to preferred language

### Progressive Web App (PWA)
- ✅ **Installable** — Add to home screen on iOS/Android/Desktop
- ✅ **Offline support** — 176 precached assets via Workbox
- ✅ **Service worker** — Full offline functionality after first load

### Performance & Quality
- ✅ **IndexedDB v2** — Columnar storage, designed for ~40x space reduction (~5 MB at 1M accounts)
- ✅ **FastBitSet.js** — Bitwise filtering, 1 bit per account per badge
- ✅ **Web Workers** — Filter operations off the main thread via Comlink
- ✅ **TanStack Virtual** — Lazy loading, designed for 60 FPS scrolling at 1M+ items
- ✅ **Search indexes** — Trigram/prefix for O(1) lookups
- ✅ **Coverage gates** — 85% statements and lines, 80% branches and functions, enforced on every run (`vitest.config.ts`)
- ✅ **TypeScript strict mode** — Full type safety with zero `any` types

### Privacy & Security
- ✅ **100% local processing** — No data leaves your device during analysis
- ✅ **No Instagram login** — Uses official Instagram data export only
- ✅ **Open source** — MIT license, full transparency

### Analytics (Privacy-Respecting)
- ✅ **Umami Analytics** — Anonymous usage statistics (no personal data, GDPR-compliant)

---

## v1.6 (Next Priority) 🔄

### Data Export
- ✅ **CSV/JSON export** — ships today: free 10-row sample, then a one-time unlock (price shown on the button in your currency) for the full file
- 🔄 **Export customization** — Choose which columns to include

### Upload UX Improvements
- 🔄 **JSON vs HTML Quiz** — Interactive guide to prevent wrong format uploads
- 🔄 **Mobile file picker hints** — iOS/Android-specific file location guidance
- 🔄 **Better error diagnostics** — More specific error messages for common mistakes

### Enhanced Data Parsing
- 🔄 **Blocked users support** — Parse and display blocked accounts
- 🔄 **Favorites support** — Parse and display favorited accounts

---

## v1.7 (Medium Priority) 🔄

### Historical Tracking
- 🔄 **Multiple data imports** — Compare data from different time periods
- 🔄 **Change detection** — See who unfollowed since last upload
- 🔄 **Timeline view** — Visualize follower changes over time

### Advanced UI Features
- 🔄 **Grouping and sorting** — Group accounts by various criteria
- 🔄 **Custom filters** — User-defined filter combinations
- 🔄 **Saved views** — Save and restore filter combinations
- 🔄 **Keyboard shortcuts** — Quick actions for power users

---

## v1.8+ (Long-term) 🔄

### Advanced Analytics
- 📊 **Connection patterns** — Analyze follow/unfollow patterns
- 📊 **Growth tracking** — Track follower growth over time
- 📊 **Engagement insights** — Correlate with post engagement data

### Integration Features
- 🔗 **Calendar integration** — Schedule regular analysis sessions
- 🔗 **Browser extension** — Easier Instagram data download flow

---

## Never (Privacy Principles) ❌

### Authentication & Live Data
- ❌ **Instagram login/authentication** — No direct Instagram API access
- ❌ **Live data fetching** — No real-time Instagram data requests
- ❌ **Active follow/unfollow actions** — No automated account actions

### Data Collection
- ❌ **Server-side processing** — All processing remains client-side
- ❌ **Profiling you from your export** — it never reaches us, so nothing can be built from it
- ❌ **Handing your export to anyone** — it never leaves your browser. What the site's own
  third parties do receive is spelled out below and in the Privacy Policy

### Commercial Features
- ❌ **Subscriptions** — Finding your unfollowers is free in full, forever. The only paid item is a one-time unlock (price shown on the button in your currency) for downloading the list as a file, and the download gives you a free sample first
- ❌ **Paywalling the analysis** — Every badge, filter and account stays free however large your export is
- ❌ **Data monetization** — No selling or monetizing user data, and no advertiser ever receives it

The site does carry advertising and affiliate links, which is how the free analysis is paid
for. Ads are served by Google AdSense and cannot target your Instagram data, because that data
never leaves your browser. See the [Privacy Policy](https://safeunfollow.app/privacy) for what
each third party does and does not receive.

---

## Release History

### v1.5.0 (January 14, 2026)
- **i18n Meta Tags** — Dynamic localized meta tags for all languages
- **Arabic RTL** — 11th language with full RTL support
- **System Theme** — 3-way theme toggle (light/dark/system)
- **Error Handling** — ErrorBoundary, 404 page, RouteErrorPage

### v1.4.0 (January 12, 2026)
- **Wizard Improvements** — Calendar reminder, deep links
- **Architecture Cleanup** — Removed V2 components, renamed HeaderV2

### v1.3.0 (January 11, 2026)
- **SSG Migration** — 80 pre-rendered pages with vite-react-ssg
- **Web Worker Filtering** — IndexedDBFilterEngine off main thread
- **PWA Support** — vite-plugin-pwa with 176 precached entries
- **Self-hosted Fonts** — @fontsource (LCP -400ms)
- **Dynamic OG Images** — @vercel/og for social sharing

### v1.2.0 (January 10, 2026)
- **Eight more languages** — ES, RU, DE, PT, TR, HI, ID, JA
- **FAQ Section** — Schema.org FAQPage structured data
- **HowTo Section** — Schema.org HowTo markup

### v1.1.0 (January 7, 2026)
- **Sample Data Mode** — Try without uploading personal data
- **Diagnostic Errors** — Rich error UI for upload failures
- **BuyMeACoffee Widget** — Donation support

### v1.0.0 (October 9, 2025)
- **IndexedDB v2** — Columnar storage, 40x space reduction
- **FastBitSet.js** — 75x faster filtering
- **Modern UI** — shadcn/ui + Tailwind CSS migration
- **Search Indexes** — Trigram/prefix for instant search

---

## Performance Targets

| Metric | v0.9 | v1.5.0 target | Improvement |
|--------|------|--------|-------------|
| Accounts supported | 50k | 1M+ | 20x |
| Filter speed (1M) | 150ms | ~5ms | 30x |
| Search speed | 3000ms | ~2ms | 1500x |
| Storage (1M) | 200 MB | 5 MB | 40x |
| Memory (1M) | 100 MB | 5 MB | 20x |
| Languages | 1 | 10 | 10x |

⚠️ Filter speed and search speed are design targets, not measurements — no benchmark harness
exists in this repo, and the only 1M-scale test mocks IndexedDB entirely and asserts a 500ms
ceiling. Languages and Tests are real, measured counts.

---

## Contributing

Want to help with development? See our [CONTRIBUTING.md](https://github.com/ignromanov/safe-unfollow/blob/main/CONTRIBUTING.md) guide.

### Priority Areas for Contributors
1. **CSV/JSON export** — High impact, well-defined scope
2. **Upload UX** — JSON vs HTML quiz, mobile file picker hints
3. **Historical tracking** — Compare multiple data exports
4. **More languages** — Add translations for new languages
5. **Documentation** — Improve guides and examples

---

*This roadmap is a living document. Priorities may shift based on community feedback. All features maintain our core privacy principles.*
