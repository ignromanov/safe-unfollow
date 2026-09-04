---
layout: default
title: "How the Instagram Unfollow Tracker Works: Architecture"
description: 'How the tracker works: 100% local processing, IndexedDB columnar storage, BitSet filtering, and how it is built to hold 1M+ accounts.'
permalink: /tech-spec/
last_updated: 2026-09-03
---

# Technical Specification - Instagram Unfollow Tracker

**Version:** 1.5.0

## 1. Project Overview

### Goal
A privacy-focused, local web application that analyzes Instagram Data Download (ZIP) files to provide insights into follower relationships without requiring Instagram authentication or sending data to external servers.

### Core Features
- **Unfollow tracking**: Identify users you follow who don't follow back
- **Follower analysis**: Find users who follow you but you don't follow back
- **Smart badges**: Categorize accounts (mutuals, close friends, restricted, etc.)
- **Lightning search**: trigram/prefix indexes, designed for sub-2ms search at 1M+ accounts (design target — see §5)
- **Advanced filtering**: BitSet-based filtering designed to stay interactive for any badge combination
- **Direct profile links**: Click to open Instagram profiles in new tabs

### Privacy Principles
- **100% local processing**: All data processing happens in the browser
- **No Instagram login**: Uses official Instagram data export only
- **Open source**: MIT license, full transparency and auditability
- **Privacy-respecting analytics**: Umami (anonymous) + Vercel (performance only)

---

## 2. Technical Architecture

### Frontend Stack
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with hooks and functional components |
| **TypeScript** | Strict mode, zero `any` types |
| **Vite** | Build tool and development server |
| **vite-react-ssg** | Static Site Generation (page count derived in `src/routes.tsx`) |
| **shadcn/ui** | Composable UI components built on Radix UI |
| **Tailwind CSS** | Utility-first styling with OKLCH color system |
| **Zustand** | Lightweight state management (<1KB UI state only) |
| **i18next** | Internationalization (10 languages) |

### Data Storage & Processing
| Technology | Purpose |
|------------|---------|
| **IndexedDB v2** | Columnar storage with 40x compression |
| **FastBitSet.js** | Bitwise filtering, 1 bit per account per badge (design target: ~32x vs boolean arrays) |
| **Comlink** | Type-safe Web Worker communication |
| **TanStack Virtual** | Virtual scrolling, renders only the visible window (design target: 60 FPS at 1M+ items) |
| **Web Workers** | Filtering runs off the main thread via Comlink |

### Build & Deployment
| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosting with Edge Functions |
| **vite-plugin-pwa** | PWA with 176 precached assets |
| **@fontsource** | Self-hosted fonts (Inter, Plus Jakarta Sans) |
| **@vercel/og** | Dynamic OG image generation |

### Testing & Quality
| Technology | Purpose |
|------------|---------|
| **Vitest** | Fast unit testing — `npm run test` reports the current count |
| **React Testing Library** | Component testing |
| **@vitest/web-worker** | Web Worker testing |
| **Coverage gates** | 85% statements/lines, 80% branches/functions (`vitest.config.ts`) |
| **ESLint** | Code quality (zero warnings) |
| **Husky** | Git hooks for quality gates |

---

## 3. State Management

### Zustand Store (<1KB constraint)
```typescript
interface AppState {
  // Filter state
  filters: Set<BadgeKey>;
  setFilters: (filters: Set<BadgeKey>) => void;

  // Upload state
  uploadStatus: 'idle' | 'loading' | 'success' | 'error';
  uploadError: string | null;
  currentFileName: string | null;

  // File metadata (NOT account data)
  fileMetadata: FileMetadata | null;
  fileDiscovery: FileDiscovery | null;
  parseWarnings: ParseWarning[];

  // Language (persisted; the URL stays the rendering source of truth)
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;

  // Hydration
  _hasHydrated: boolean;
}
```

**Critical Constraints:**
- ❌ NO account data arrays in store
- ❌ NO arrays >10 items
- ❌ NO parsed data of any kind
- ❌ NO language state (URL is source of truth)
- ✅ If store >1KB, architecture is broken

### Language Detection (URL as Source of Truth)
```typescript
// src/config/languages.ts
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'de', 'es', 'fr', 'id', 'ja', 'pt', 'ru', 'tr'];
export const RTL_LANGUAGES = ['ar'];

export function detectLanguageFromUrl(): SupportedLanguage {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/(ar|de|es|fr|id|ja|pt|ru|tr)(\/|$)/);
  return match ? match[1] as SupportedLanguage : 'en';
}
```

---

## 4. IndexedDB v2 Architecture

### Database: `instagram-tracker-v2`

| Store | Purpose | Key |
|-------|---------|-----|
| **files** | File metadata registry | `hash` |
| **columns** | Username/href as packed Uint8Arrays | `${hash}:${column}` |
| **bitsets** | Badge presence (1-bit per account) | `${hash}:${badge}` |
| **timestamps** | Sparse time data for temporal badges | `${hash}:timestamps` |
| **indexes** | Trigram/prefix search indexes (3-day TTL) | `${hash}:search` |

### Data Flow
```
Upload ZIP
    ↓
Parse Worker (Web Worker)
    ├── Extract ZIP (JSZip)
    ├── Parse JSON files
    └── Emit 10k account chunks
    ↓
IndexedDB Service
    ├── Pack columns (Uint8Array)
    └── Update bitsets (FastBitSet)
    ↓
Background: Build search indexes (trigram + prefix)
    ↓
Zustand: uploadStatus = 'success'
```

### Filter Flow (via Web Worker)
```
FilterChips.onClick(badge)
    ↓
useFilterWorker.filterToIndices(query, filters)
    ↓
Web Worker (filter-worker.ts via Comlink)
    ├── Load bitsets (cached)
    ├── Intersect bitsets (FastBitSet.intersection)
    └── Apply search if query
    ↓
Result: number[] indices
    ↓
TanStack Virtual: render visible items (~20)
    ↓
useAccountDataSource: lazy load accounts by indices
```

---

## 5. Performance Specifications

### Benchmarks (1M accounts)

These are design targets, not measurements: no benchmark harness exists in this repository,
and the only 1M-scale test (`IndexedDBFilterEngine.test.ts`) mocks the whole IndexedDB layer
and asserts a 500ms ceiling — it measures in-memory bitset iteration, not storage. What IS
true: the engine is built and unit-tested against a 1M-account bitset.

| Metric | Target |
|--------|--------|
| Filter (single badge) | under 10 ms |
| Filter (3 badges) | under 10 ms |
| Search (indexed) | under 5 ms |
| Storage | under 20 MB |
| Memory (runtime) | under 20 MB |
| INP | under 200 ms |
| LCP | under 2.5 s |

### Optimization Strategies
- **Columnar storage**: 40x space reduction vs row-based
- **BitSet filtering**: 32x faster than boolean arrays
- **Web Workers**: Filter operations off main thread
- **Virtual scrolling**: Render only ~20 visible items
- **LRU caching**: 500 accounts per slice, 20 slices max
- **Trigram indexes**: O(1) search vs O(n) linear scan

---

## 6. Internationalization (i18n)

### Supported Languages (10)

| Language | Code | RTL | Locale |
|----------|------|-----|--------|
| English | en | — | en_US |
| Español | es | — | es_ES |
| Русский | ru | — | ru_RU |
| Deutsch | de | — | de_DE |
| Português | pt | — | pt_BR |
| Türkçe | tr | — | tr_TR |
| Bahasa Indonesia | id | — | id_ID |
| 日本語 | ja | — | ja_JP |
| العربية | ar | ✅ | ar_SA |
| Français | fr | — | fr_FR |

### SSG Architecture
- **Pre-rendered pages**: derived, never written down on this page. `src/routes.tsx` states the
  shape — the static routes, once per supported language — and
  `src/__tests__/docs/architecture-facts.test.ts` computes the number from it. The last audit found
  this count copied into six documents with four different values, and it dropped by more than
  half when the wizard step routes stopped being pages (GH#102)
- **Path-based routing**: `/es/upload`, `/ar/results`, etc.
- **Localized meta tags**: Dynamic title/description per language
- **hreflang tags**: SEO optimization for language variants
- **Full page reload on language change**: Ensures correct SSG meta

---

## 7. File Structure

```
src/
├── core/                 # Domain logic
│   ├── types.ts          # Core types (Account, BadgeKey, etc.)
│   ├── badges/           # Badge computation logic
│   └── parsers/          # Instagram ZIP parsing
├── lib/                  # Infrastructure
│   ├── store.ts          # Zustand (UI state only!)
│   ├── indexeddb/        # Columnar storage, bitsets
│   ├── filtering/        # BitSet filter engine
│   └── search-index.ts   # Trigram/prefix indexes
├── config/               # Configuration
│   └── languages.ts      # Language config (single source of truth)
├── hooks/                # React hooks
│   ├── useInstagramData.ts
│   ├── useAccountFiltering.ts
│   ├── useAccountDataSource.ts
│   ├── useFilterWorker.ts      # Web Worker hook
│   ├── useLanguageFromPath.ts  # Sync language from URL
│   └── useLanguagePrefix.ts    # Get language prefix for nav
├── workers/              # Web Workers
│   └── filter-worker.ts  # IndexedDBFilterEngine (Comlink)
├── pages/                # SSG page components
│   ├── HomePage.tsx      # / route
│   ├── UploadPage.tsx    # /upload route (the guide opens here)
│   ├── ResultsPage.tsx   # /results route
│   └── ...               # 7 pages total
├── components/           # UI components
│   ├── ui/               # shadcn/ui primitives
│   ├── Layout.tsx        # Root layout (ThemeProvider, Header, Footer)
│   └── *.tsx             # App components
├── locales/              # i18n translations
│   ├── en/               # English
│   ├── es/               # Spanish
│   └── ...               # 10 languages
├── routes.tsx            # SSG route definitions
├── main.tsx              # ViteReactSSG entry point
└── __tests__/            # Tests (mirror structure)
```

---

## 8. Data Schema

### Input Format (Instagram Data Download)
```
connections/followers_and_following/
├── following.json              # Accounts you follow
├── followers_1.json            # Your followers (may be split)
├── close_friends.json          # Close friends list (optional)
├── pending_follow_requests.json    # Pending requests (optional)
├── recently_unfollowed_profiles.json  # Recently unfollowed (optional)
└── restricted_profiles.json    # Restricted accounts (optional)
```

### Core Calculations
- **Set A**: Usernames you follow (from `following.json`)
- **Set B**: Usernames who follow you (from `followers_*.json`)
- **Not following back**: A − B (excluding pending/restricted)
- **Not followed back**: B − A
- **Mutuals**: A ∩ B

---

## 9. Browser Compatibility

### Supported Browsers
- **Chrome**: 90+ (recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Required Features
- ES2020+ support
- IndexedDB
- Web Workers
- Service Workers (for PWA)
- CSS Grid/Flexbox

---

## 10. Security Considerations

### Client-Side Security
- **Input validation**: Sanitize all user inputs
- **XSS prevention**: No dynamic HTML injection
- **Content Security Policy**: Strict CSP headers
- **Subresource Integrity**: For CDN resources

### Data Privacy
- **The export is never transmitted**: parsing and filtering run entirely in the browser
- **Anonymous analytics**: Umami (no personal data)
- **Cookies**: theme preference, and — once the visitor consents — Google's advertising and
  consent cookies. None of them can reach the Instagram export, which never leaves the device
- **Secure defaults**: Privacy-first configuration

---

## 11. PWA Configuration

### Workbox Strategy
- **Precache**: 176 static assets
- **Runtime caching**: NetworkFirst for HTML pages
- **Offline fallback**: Cached app shell

### Manifest
```json
{
  "name": "Instagram Unfollow Tracker",
  "short_name": "Instagram Unfollow Tracker",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000"
}
```

---

## 12. Development Commands

```bash
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Production build (SSG)
npm run test         # Run tests (Vitest)
npm run test:coverage # Tests with 85% threshold
npm run lint:strict  # ESLint (zero warnings)
npm run type-check   # TypeScript validation
npm run code:check   # lint:strict + type-check
```

---

*This specification reflects v1.5.0 architecture. See CHANGELOG.md for version history.*
