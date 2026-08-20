---
layout: default
title: How Instagram Unfollow Tracker Works — Privacy & Architecture
description: Technical deep-dive into Instagram Unfollow Tracker. Learn about 100% local processing, IndexedDB columnar storage, BitSet filtering, and how we handle 1M+ accounts privately.
permalink: /tech-spec/
last_updated: 2026-01-16
---

# Technical Specification - Instagram Unfollow Tracker

**Version:** 1.5.0 | **Last Updated:** January 16, 2026

## 1. Project Overview

### Goal
A privacy-focused, local web application that analyzes Instagram Data Download (ZIP) files to provide insights into follower relationships without requiring Instagram authentication or sending data to external servers.

### Core Features
- **Unfollow tracking**: Identify users you follow who don't follow back
- **Follower analysis**: Find users who follow you but you don't follow back
- **Smart badges**: Categorize accounts (mutuals, close friends, restricted, etc.)
- **Lightning search**: <2ms search with trigram/prefix indexes (1M+ accounts)
- **Advanced filtering**: <5ms BitSet-based filtering for any badge combination
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
| **vite-react-ssg** | Static Site Generation (80+ pre-rendered pages) |
| **shadcn/ui** | Composable UI components built on Radix UI |
| **Tailwind CSS** | Utility-first styling with OKLCH color system |
| **Zustand** | Lightweight state management (<1KB UI state only) |
| **i18next** | Internationalization (11 languages) |

### Data Storage & Processing
| Technology | Purpose |
|------------|---------|
| **IndexedDB v2** | Columnar storage with 40x compression |
| **FastBitSet.js** | Bitwise filtering operations (75x faster) |
| **Comlink** | Type-safe Web Worker communication |
| **TanStack Virtual** | Virtual scrolling for 1M+ items at 60 FPS |
| **Web Workers** | Off-thread filtering (INP: 180ms) |

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
| **Vitest** | Fast unit testing (1,601 tests) |
| **React Testing Library** | Component testing |
| **@vitest/web-worker** | Web Worker testing |
| **98% coverage** | Comprehensive test suite |
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

  // Theme (3-way toggle)
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

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
export const SUPPORTED_LANGUAGES = ['en', 'es', 'ru', 'de', 'pt', 'tr', 'hi', 'id', 'ja', 'ar', 'fr'];
export const RTL_LANGUAGES = ['ar'];

export function detectLanguageFromUrl(): SupportedLanguage {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/(en|es|ru|de|pt|tr|hi|id|ja|ar|fr)(\/|$)/);
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

| Metric | Target | Achieved |
|--------|--------|----------|
| Filter (single badge) | <10ms | ~3ms |
| Filter (3 badges) | <10ms | ~5ms |
| Search (indexed) | <5ms | ~2ms |
| Storage | <20MB | ~5MB |
| Memory (runtime) | <20MB | ~5MB |
| INP | <200ms | 180ms |
| LCP | <2.5s | ~1.3s |

### Optimization Strategies
- **Columnar storage**: 40x space reduction vs row-based
- **BitSet filtering**: 32x faster than boolean arrays
- **Web Workers**: Filter operations off main thread
- **Virtual scrolling**: Render only ~20 visible items
- **LRU caching**: 500 accounts per slice, 20 slices max
- **Trigram indexes**: O(1) search vs O(n) linear scan

---

## 6. Internationalization (i18n)

### Supported Languages (11)

| Language | Code | RTL | Locale |
|----------|------|-----|--------|
| English | en | — | en_US |
| Español | es | — | es_ES |
| Русский | ru | — | ru_RU |
| Deutsch | de | — | de_DE |
| Português | pt | — | pt_BR |
| Türkçe | tr | — | tr_TR |
| हिन्दी | hi | — | hi_IN |
| Bahasa Indonesia | id | — | id_ID |
| 日本語 | ja | — | ja_JP |
| العربية | ar | ✅ | ar_SA |
| Français | fr | — | fr_FR |

### SSG Architecture
- **80+ pre-rendered pages**: 11 languages × 8 routes
- **Path-based routing**: `/es/wizard`, `/ar/upload`, etc.
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
│   ├── WizardPage.tsx    # /wizard route
│   ├── UploadPage.tsx    # /upload route
│   ├── ResultsPage.tsx   # /results route
│   └── ...               # 8 pages total
├── components/           # UI components
│   ├── ui/               # shadcn/ui primitives
│   ├── Layout.tsx        # Root layout (ThemeProvider, Header, Footer)
│   └── *.tsx             # App components
├── locales/              # i18n translations
│   ├── en/               # English
│   ├── es/               # Spanish
│   └── ...               # 11 languages
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
