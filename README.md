<div align="center">
  <img src="./public/logo.svg" width="100" height="100" alt="Logo">
  <h1>SafeUnfollow — Instagram Unfollow Tracker</h1>
</div>

<br>

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22663615.svg)](https://doi.org/10.5281/zenodo.22663615)
![Version](https://img.shields.io/github/package-json/v/ignromanov/safe-unfollow?label=Version&color=blue)
![Privacy: 100% local](https://img.shields.io/badge/Privacy-100%25%20local-success)
![License: MIT](https://img.shields.io/badge/License-MIT-blue)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-informational)
![Analysis: free](https://img.shields.io/badge/Analysis-Free-green)
![CI](https://github.com/ignromanov/safe-unfollow/actions/workflows/code-quality.yml/badge.svg)
![Languages: 10](https://img.shields.io/badge/Languages-10-purple)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange)

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)

<div align="left">
    <a href="https://www.producthunt.com/products/instagram-unfollow-tracker?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-instagram&#0045;unfollow&#0045;tracker" target="_blank">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1039686&theme=light&t=1763490363396" alt="Instagram Unfollow Tracker - See who unfollowed you without login or ban risks | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
    </a>
</div>

<br>

**Find out who unfollowed you on Instagram** — analyze your Instagram Data Download ZIP locally to discover mutuals, non-mutuals, and connection patterns. No login, and the export never reaches a server: the ZIP is parsed in your browser.

## 🎯 What it does

Upload your Instagram data export and instantly see:

- **Who unfollowed you** — accounts that stopped following you
- **Who you follow but doesn't follow back** — one-way connections
- **Mutual followers** — accounts you both follow
- **Connection patterns** — understand your Instagram network

All processing happens **100% locally** in your browser. Your data never leaves your device.

## 📸 Screenshots

<div align="center">
  <img src="assets/hero.png" alt="Instagram Unfollow Tracker - Landing Page" width="100%" />
  <p><em>Clean landing page with clear call-to-action</em></p>
</div>

<div align="center">
  <img src="assets/upload-zip.png" alt="Upload your Instagram ZIP file" width="100%" />
  <p><em>Drag and drop upload with pre-upload checklist</em></p>
</div>

<div align="center">
  <img src="assets/analysis-result.png" alt="Analysis Results - Filter and search accounts" width="100%" />
  <p><em>Analysis results with smart filters and account badges</em></p>
</div>

<details>
<summary>📱 <strong>View Mobile Screenshots</strong></summary>

<div align="center">
  <img src="assets/upload-zip-mobile.png" alt="Mobile view - Upload screen" width="375" />
  <p><em>Mobile-optimized file upload</em></p>
</div>

<div align="center">
  <img src="assets/close-friend-mobile.png" alt="Mobile view - Close Friends filter" width="375" />
  <p><em>Filter by Close Friends and other badges on mobile</em></p>
</div>

</details>

## ✨ Key Features

- 🔍 **Find unfollowers** — see exactly who stopped following you
- 🔄 **Mutual analysis** — discover who follows you back vs. one-way connections
- 🏷️ **Smart badges** — Following, Followers, Mutuals, Not following back, Not followed back, Pending, Restricted, Close friends, Unfollowed, Dismissed
- 🔎 **Lightning-fast search** — trigram/prefix indexes for instant results (even with 1M+ accounts)
- ⚡ **Optimized for scale** — columnar storage and bitsets, built for millions of accounts
- 📱 **Responsive design** — works perfectly on desktop and mobile
- 🌙 **Dark mode** — comfortable viewing in any lighting
- 💾 **Smart caching** — instant reload with IndexedDB persistence
- 📊 **Sample data** — try it without uploading your own data
- 🌍 **10 languages** — English, Spanish, Russian, German, Portuguese, Turkish, French, Indonesian, Japanese, Arabic (RTL)
- 📲 **PWA support** — install as an app from the browser menu
- 🛡️ **Error recovery** — graceful error handling with recovery options

## 🌍 Multilingual Support

Available in **10 languages** with full RTL support:

| Language         | Code | RTL |
| ---------------- | ---- | --- |
| English          | en   | —   |
| Español          | es   | —   |
| Русский          | ru   | —   |
| Deutsch          | de   | —   |
| Português        | pt   | —   |
| Türkçe           | tr   | —   |
| Français         | fr   | —   |
| Bahasa Indonesia | id   | —   |
| 日本語           | ja   | —   |
| العربية          | ar   | ✅  |

- **73 pre-rendered pages** — SSG for instant load and SEO
- **Dynamic meta tags** — localized titles/descriptions per language
- **Browser language detection** — auto-redirects to preferred language

## 🚀 Why choose this over paid tools?

| Feature             | Instagram Unfollow Tracker                               | Paid Apps (Unfollowgram, etc.) |
| ------------------- | -------------------------------------------------------- | ------------------------------ |
| **Price**           | 💰 Free analysis · export paid once                      | 💸 $5-10/month                 |
| **Privacy**         | 🔒 Parsed in your browser                                | ⚠️ Sent to cloud servers       |
| **Instagram Login** | ✅ Not required                                          | ❌ Required (risky!)           |
| **Account Limit**   | ✅ 1M+ by design                                         | ⚠️ 10k-100k max                |
| **Data Processing** | ⚡ In your browser, no round-trip                        | 🐌 Cloud round-trip            |
| **Open Source**     | ✅ MIT license                                           | ❌ Closed source               |
| **Ads/Tracking**    | ⚠️ Ads + analytics — never usernames or your export file | ⚠️ Usually present             |
| **Platform**        | 🌐 Web (all devices)                                     | 📱 Mobile apps usually         |

### Why This Matters

- **🔒 100% Private** — all processing happens locally in your browser (IndexedDB)
- **💰 Free analysis** — no subscription, no account; the file export is a one-time purchase
- **🔓 Open Source** — transparent code you can audit and customize
- **⚡ Fast** — no network round-trip; filtering is local
- **🛡️ No Account Risk** — no Instagram login required, respects platform rules
- **🎯 Accurate Results** — clear mutual/non-mutual detection without gimmicks
- **📈 Scales to millions** — handles 1M+ accounts with ease (vs 100k limit in paid apps)

## 🚀 Quick Start

### Try it online

Visit the live demo: **[safeunfollow.app](https://safeunfollow.app)**

### Run locally

```bash
git clone https://github.com/ignromanov/safe-unfollow.git
cd safe-unfollow
npm install
npm run dev
```

Open the app and click **"Upload ZIP"** to load your Instagram Data Download, or **"Load sample"** to try the built-in demo data.

## 📥 How to get your Instagram data

### Quick Steps:

1. Go to [Meta Accounts Center](https://accountscenter.instagram.com/)
2. Navigate to **Your information and permissions** → **Download your information**
3. Select:
   - **Some of your information**
   - **Section**: Followers and Following
   - **Format**: JSON
   - **Date range**: All time
4. Download the ZIP file and upload it in the app

📖 **Detailed step-by-step guide**: Click the "❓ Help" button in the app for complete instructions with screenshots

## 🔒 Privacy & Security

- **100% Local Processing** — your data never leaves your device
- **Your export stays put** — the analytics we run never receive usernames or your export file
- **No Instagram Login** — works with your data export only
- **Open Source** — you can audit the code yourself

## ⚡ Performance

Built to handle massive datasets with cutting-edge optimization:

| Metric               | 10k accounts | 100k accounts | 1M accounts |
| -------------------- | ------------ | ------------- | ----------- |
| **Storage**          | ~100 KB      | ~1 MB         | ~5 MB       |
| **Filter Speed**     | <1ms         | ~2ms          | ~5ms        |
| **Search (indexed)** | <1ms         | <1ms          | ~1ms        |
| **Memory Usage**     | ~500 KB      | ~2 MB         | ~5 MB       |

⚠️ Filter speed and search speed are design targets, not measurements — no benchmark harness
exists in this repo, and the only 1M-scale test mocks IndexedDB entirely and asserts a 500ms
ceiling. The storage and memory columns are targets on the same footing.

**Technology Stack:**

- **IndexedDB v2** — columnar storage: usernames packed into typed arrays, not objects
- **FastBitSet.js** — one bit per account per badge, filtered with bitwise operations
- **TanStack Virtual** — renders only visible items (60 FPS scrolling)
- **Web Workers + Comlink** — type-safe off-thread filtering
- **Trigram/Prefix Indexes** — O(1) search instead of O(n) linear scan
- **vite-react-ssg** — 73 pre-rendered pages for SEO and instant loads
- **PWA (Workbox)** — runtime caching; only icons and the manifest are precached (`vite/pwa-config.ts`)

📖 **Deep dive:** [IndexedDB Architecture](INDEXEDDB_ARCHITECTURE.md)

## 🧪 Quality & Reliability

- **Tested** — the full suite runs in CI on every push
- **TypeScript Strict Mode** — type-safe development with full type checking
- **Modern Stack** — React 18, Vite, shadcn/ui, Tailwind CSS
- **Code Quality** — ESLint, Husky git hooks, automated quality checks
- **Error Boundaries** — graceful error handling with recovery UI
- **PWA** — installable; pages you have already opened keep working with the network off

## ❓ FAQ

**Q: Is it safe to use?**  
A: Yes! All processing happens locally in your browser. Nothing is uploaded to any server.

**Q: Do I need my Instagram password?**  
A: No. You only need the ZIP file from Instagram Data Download.

**Q: What does "Not following back" mean?**  
A: Accounts you follow who don't follow you back (excluding pending/restricted accounts).

**Q: Can I use it offline?**  
A: Partly. Pages and analyses you have already run keep working with the network off; a first visit and the first upload need a connection.

**Q: Does it work on mobile?**
A: Yes, the interface is fully responsive and works on all devices.

**Q: What languages are supported?**
A: 10 languages including Arabic with RTL support. The app auto-detects your browser language.

📖 **More questions?** See [FAQ](docs/faq.md) or [Troubleshooting Guide](docs/troubleshooting.md)

## 📄 Citing SafeUnfollow

Use the **Cite this repository** button above, or [`CITATION.cff`](CITATION.cff) directly.
The DOI below is the concept DOI and always resolves to the newest archived version:

> Romanov, I. _SafeUnfollow_. https://doi.org/10.5281/zenodo.22663615

The version, repository, site and licence in `CITATION.cff` are checked against
`package.json` on every CI run, so a citation cannot disagree with the code it points at.
The source tree is also archived by [Software Heritage](https://archive.softwareheritage.org/browse/origin/directory/?origin_url=https://github.com/ignromanov/safe-unfollow).

## 🤝 Contributing

Contributions are welcome! Whether it's:

- 🐛 Bug reports
- 💡 Feature requests
- 🔧 Code improvements
- 📖 Documentation updates

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for guidelines.

## 📚 Documentation

- **[User Guide](docs/user-guide.md)** - Complete step-by-step tutorial
- **[FAQ](docs/faq.md)** - Common questions and answers
- **[Troubleshooting](docs/troubleshooting.md)** - Problem-solving guide
- **[Data Download Guide](docs/instagram-export.md)** - How to get your Instagram data
- **[Accessibility](docs/accessibility.md)** - Accessibility features and support
- **[Privacy Policy](docs/privacy.md)** - Data handling principles
- **[Roadmap](docs/roadmap.md)** - Future features
- **[Technical Specs](docs/tech-spec.md)** - Technical details

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

**Disclaimer**: This project is not affiliated with Instagram/Meta. Use your data export in accordance with platform rules.

---

## 💖 Support Me

⭐ **Found this useful?** Star the repo and share it with others looking for a free Instagram unfollow tracker!

<p align="left">
  <a href="https://www.buymeacoffee.com/ignromanov" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
  </a>
</p>
