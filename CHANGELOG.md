# Changelog

All notable changes to Instagram Unfollow Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-09-08

First tagged release. Everything from 0.x through 1.5.0 shipped continuously to
production and was never tagged, so there is no commit range this entry could
summarise honestly — the per-change history is in the repository's commits, and
this entry deliberately does not backfill eight months of it.

What the release itself is for: the repository can now be cited. Before it, the
project named itself four ways and stated three versions at once, and a Zenodo
DOI is minted from the release event and never re-minted.

### Added

- `CITATION.cff`, and a gate deriving its version, repository, site and licence
  from `package.json` instead of a second hand-typed copy (#226).

### Fixed

- The README stopped stating design targets as measurements: figures with no
  derivation in the repository (`40x`, `75x`, `32x`, `5ms at 1M`), an account
  limit described as unlimited, and a test count off by 2.5x (#227).
- The language list disagreed with `src/config/languages.ts` in both directions
  — Hindi named, French missing — past a gate that compared the count and not
  the members (#227).
- README and `docs/faq.md` stopped denying data collection the instrumentation
  performs: `account_count` leaves from eight call sites and `file_size_mb` from
  two (#228).

## [1.5.0] - 2026-01-14

### Added

- **i18n Meta Tags Localization**: Dynamic title/description per language
  - og:locale localization (es_ES, ru_RU, de_DE, ar_SA, etc.)
  - og:locale:alternate for all supported languages
  - Localized OG images with `?lang=` parameter
- **Arabic Language (RTL)**: 10th language with full RTL support
- **System Theme Toggle**: 3-way theme (light/dark/system)
- **Error Handling**: ErrorBoundary, 404 page, RouteErrorPage
- **Rescue Plan Banner**: Collapsible banner with progressive disclosure

### Changed

- Language now determined from URL (single source of truth)
- LanguageSwitcher uses full page reload for correct SSG meta
- Centralized language config in `src/config/languages.ts`

### Fixed

- React hooks order violation in rescue-plan component
- Turkish Unicode characters for brand consistency
- Hydration mismatch in useI18nReady hook

## [1.4.0] - 2026-01-12

### Added

- **Wizard Improvements**: Calendar reminder, deep links (`/wizard/step/N`)
- **GitHub Link**: Source code link in footer
- **Page Loading States**: Skeleton loaders for better UX

### Changed

- Removed V2 architecture (steps, journey state)
- Renamed HeaderV2 to Header
- Migrated from pnpm to npm

### Fixed

- Navigation to use path-based URLs
- CSP for BuyMeCoffee widget and Facebook Meta Pixel

## [1.3.0] - 2026-01-11

### Added

- **SSG with Path-based Routing**: 80 pre-rendered pages (10 languages × 8 routes)
- **Web Worker Filtering**: IndexedDBFilterEngine off main thread via Comlink
- **PWA Support**: vite-plugin-pwa with 176 precached entries
- **Self-hosted Fonts**: @fontsource for Inter and Plus Jakarta Sans (LCP -400ms)
- **Dynamic OG Images**: @vercel/og Edge Function for social sharing
- **BreadcrumbSchema**: JSON-LD for rich SERP display
- **Comprehensive SEO Audit**: P0/P1/P2 optimizations for Product Hunt launch

### Performance

- INP improved: 350ms → 180ms (Web Worker)
- LCP improved: -400ms (self-hosted fonts)
- Bundle reduced: -12KB (dynamic i18n, Radix chunks)

## [1.2.0] - 2026-01-10

### Added

- **9 Languages**: Spanish, Russian, German, Portuguese, Turkish, Hindi, Indonesian, Japanese
- **Automatic Language Detection**: Browser language detection with SEO hreflang tags
- **FAQ Section**: 7 FAQs with Schema.org FAQPage structured data
- **HowTo Section**: 10-step guide with Schema.org HowTo markup

### Changed

- Improved test coverage from 78% to 92%
- Added comprehensive i18n test suite

## [1.1.0] - 2026-01-07

### Added

- **Sample Data Mode**: Try without uploading personal data (`/sample` route)
- **Diagnostic Error Screen**: Rich error UI for upload failures with specific fix instructions
- **Guided Journey Flow**: Hash navigation with mobile optimization
- **BuyMeACoffee Widget**: Donation support integration

### Changed

- Redesigned FilterChips, Footer, FAQ, HowTo components
- Updated color palette and typography
- Added tracking opt-out for analytics

### Fixed

- Smart error diagnostics for JSON format issues
- Memory leaks in component lifecycle

## [1.0.0] - 2025-10-09

### Added

- **IndexedDB v2 Architecture**: Complete rewrite with columnar storage
  - 40x space reduction (1M accounts: ~5 MB vs ~200 MB)
  - Bitset-based filtering using FastBitSet.js
  - Lazy loading with TanStack Virtual
  - Trigram/prefix search indexes
  - Web Worker integration for background processing

- **Modern UI Framework**: Migrated to shadcn/ui and Tailwind CSS
  - Radix UI component primitives for accessible UI
  - OKLCH color system for consistent theming
  - `next-themes` for seamless theme management
  - `lucide-react` for consistent icon system
  - Reduced bundle size and improved customizability

- **Enhanced Component Architecture**: Modular and maintainable components
  - `AccountListSection` and `AccountListVirtualList` for better organization
  - Dedicated `Header`, `Footer`, `Logo`, `HelpButton` components
  - `ProgressBar`, `SkeletonLoader`, `ScrollToTop` for better UX
  - `FileUploadSection` with improved drag & drop

- **Development Infrastructure**:
  - Husky git hooks for pre-commit and pre-push quality checks
  - Comprehensive `npm run code:check` command
  - Automated unused exports detection
  - New GitHub Actions workflow for code quality
  - ESLint flat config with modern best practices

- **Documentation**:
  - `INDEXEDDB_ARCHITECTURE.md` - Complete technical documentation
  - `FILTER_OPTIMIZATION.md` - Performance optimization guide
  - `CLAUDE.md` - Claude Code integration guide
  - `.claude/` directory with project prompts and commands
  - Comprehensive user guides (FAQ, troubleshooting, accessibility)

### Changed

- **Storage**: Migrated from localStorage to IndexedDB v2
- **State Management**: Refactored Zustand store to keep under 1KB (UI state only)
- **Components**: Updated all components to work with lazy-loaded data
- **Search**: Improved with trigram/prefix indexes for instant results
- **Testing**: Expanded to 98% coverage with 151 tests passing

### Removed

- Mantine UI dependencies (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`)
- `DataDownloadInstructions.tsx` component (consolidated into modal)
- Custom `useDebounce.ts` hook (using `use-debounce` library)

### Performance

- Filter speed (1M accounts): **2-5ms** (was ~150ms) - **75x faster**
- Search speed (indexed): **~1ms** (was ~3000ms) - **100x faster**
- Storage size (1M accounts): **~5 MB** (was ~200 MB) - **40x smaller**
- Memory usage: **~5 MB** (was ~100 MB) - **20x less**
- Scrolling: **60 FPS** with virtualization

## [0.9.0] - 2024-12-15

### Added

- Initial public release
- ZIP file upload and parsing
- Badge-based filtering system
- Real-time search functionality
- Dark mode support
- Responsive design
- 100% local processing (no server communication)

### Features

- Unfollow tracking
- Mutual follower analysis
- Smart badge categorization
- Direct Instagram profile links
- Sample data for testing

---

**Legend**:

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
- `Performance` for performance improvements
