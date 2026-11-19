# Release Template for GitHub Releases

Use this template when creating a new GitHub Release. Copy the relevant sections and customize for your specific release.

---

## Version X.Y.Z - [Release Name]

**Release Date:** YYYY-MM-DD

[Brief 1-2 sentence overview of the release]

## 🎉 Highlights

[3-5 bullet points of the most important changes users will care about]

- 🚀 **Performance** - [describe major performance improvement]
- ✨ **New Feature** - [describe exciting new feature]
- 🎨 **UI/UX** - [describe UI improvements]
- 🐛 **Bug Fixes** - [describe major bug fixes]
- 📚 **Documentation** - [describe doc improvements]

## ✨ New Features

**[Feature Category 1]**

- Feature description with user benefit
- Another feature in this category

**[Feature Category 2]**

- Feature description
- Another feature

## 🔧 Improvements

- Improvement 1 with user impact
- Improvement 2 with user impact
- Performance enhancement with metrics if applicable

## 🐛 Bug Fixes

- Fixed [issue description] (#issue-number)
- Resolved [problem description] (#issue-number)
- Corrected [bug description] (#issue-number)

## 📚 Documentation

- Updated [doc name] with [changes]
- Added [new guide/tutorial]
- Improved [existing doc]

## ⚠️ Breaking Changes

[If applicable - list any breaking changes with migration instructions]

- **Breaking change 1**: Description and how to migrate
- **Breaking change 2**: Description and how to migrate

## 🔮 What's Next

[Brief preview of what's coming in the next release - link to roadmap]

See our [Roadmap](../docs/roadmap.md) for more details.

## 📦 Installation

**Online (Recommended):**
Visit [safeunfollow.app](https://safeunfollow.app)

**Local Development:**

```bash
git clone https://github.com/ignromanov/safe-unfollow.git
cd safe-unfollow
npm install
npm run dev
```

## 🤝 Contributors

Thank you to everyone who contributed to this release!

[Use GitHub's auto-generated release notes contributor list or manually list key contributors]

## 📊 Stats

[Optional - include interesting project stats]

- **Total commits:** X
- **Contributors:** Y
- **Files changed:** Z
- **Lines added/removed:** +A / -B
- **Test coverage:** X%
- **Performance improvement:** X% faster

## 🔗 Links

- **[Full Changelog](../CHANGELOG.md#XYZ)**
- **[Migration Guide](../docs/migration-guide.md)** (if applicable)
- **[Documentation](../README.md#documentation)**
- **[Report Issues](https://github.com/ignromanov/safe-unfollow/issues)**

---

## Example Release Notes

### Example: Minor Version (v1.1.0)

```markdown
# v1.1.0 - Enhanced Export Features

**Release Date:** 2025-11-15

This release focuses on data export capabilities and improved parsing.

## 🎉 Highlights

- 📊 **CSV Export** - Export your filtered results to CSV for external analysis
- 📂 **Enhanced Parsing** - Support for blocked accounts and favorites
- ⚡ **Performance** - 20% faster upload processing
- 🐛 **Bug Fixes** - Resolved 5 community-reported issues

## ✨ New Features

**Data Export**

- Export filtered accounts to CSV with customizable columns
- Batch export for multiple filter combinations
- Export progress indicator for large datasets

**Enhanced Data Parsing**

- Parse and display blocked accounts from Instagram data export
- Support for favorites/close friends list
- Improved error messages for malformed data files

## 🔧 Improvements

- Upload processing is now 20% faster for files >100k accounts
- Better mobile touch interactions for filter chips
- Improved keyboard navigation with shortcuts (Ctrl+K for search)

## 🐛 Bug Fixes

- Fixed search not working for accounts with special characters (#42)
- Resolved virtual scroll jump on filter change (#38)
- Corrected badge counts when using multiple filters (#45)

## 📚 Documentation

- Added CSV export guide to user documentation
- Updated FAQ with export-related questions
- Improved troubleshooting guide with new common issues

## 🔮 What's Next

v1.2 will bring advanced UI features including saved views, custom filter combinations, and connection insights. See our [Roadmap](../docs/roadmap.md) for details.
```

### Example: Patch Version (v1.0.1)

```markdown
# v1.0.1 - Bug Fixes

**Release Date:** 2025-10-16

Quick patch release fixing critical bugs reported in v1.0.0.

## 🐛 Bug Fixes

- Fixed IndexedDB migration failing on Safari (#52)
- Resolved dark mode flicker on initial load (#51)
- Corrected filter count showing incorrect numbers (#50)

## 🔧 Improvements

- Better error messages for unsupported browsers
- Improved loading performance on slower connections

## 📚 Documentation

- Updated troubleshooting guide with Safari-specific solutions
- Added browser compatibility table to README
```

---

## Release Checklist

`develop` is the integration branch and `main` the release branch (#345). A release is
two PRs and a tag, in this order:

1. **Bump PR into `develop`** (squash), from a `chore/release-X.Y.Z` branch:
   - [ ] `package.json` and the two root entries of `package-lock.json` (not a
         dependency that happens to share the old number)
   - [ ] `CITATION.cff` — `version` and `date-released`
   - [ ] `docs/tech-spec.md` — both version mentions
   - [ ] `CHANGELOG.md` — move `[Unreleased]` under `## [X.Y.Z] - YYYY-MM-DD`
   - [ ] **Hero chip** — `version` in `src/locales/*/hero.json`, all ten locales.
         Format `V{major}.{minor} · {feature} · {feature}`: the version without the patch,
         then the two biggest reader-facing features of the 1.x line that the rest of the
         hero does not already say (no login, free, local and 1M+ are said elsewhere),
         worded the way people search. Keep it under ~45 characters in English; it is one
         line on a 360px phone. A patch release leaves it alone unless it ships such a
         feature. The text is copy on `/`: lumen-cro signs it off, and the deploy date goes
         into `analytics/measurement-boundaries.md`.
         `citation-metadata.test.ts` checks only that major.minor matches `package.json`,
         so an unchanged chip passes on every patch release; the gate does not do this step for you.
   - [ ] **Release History** in `docs/roadmap.md`: a dated entry with the 2–4 changes a
         reader would notice, and `last_updated` set to the release date (it drives the
         page's sitemap `<lastmod>`). This is the on-domain changelog that
         `SoftwareApplication.releaseNotes` points at, so a release missing here leaves
         the JSON-LD linking to a history that stops one version early. `softwareVersion`
         and `dateModified` need no edit: they derive from `package.json` and
         `CITATION.cff`.
   - [ ] **One feature set**: the hero chip, `featureList` in
         `src/components/OrganizationSchema.tsx` and "What ships today" in
         `docs/roadmap.md` name the same headline features. `featureList` is ingested as
         fact, so it takes no target and no caveat (`structured-data-claims.test.tsx`)
   - [ ] `code-quality` and `build-test` green
2. **Release PR `develop → main`** — **merge commit, never squash**: a squashed release
   makes the two branches diverge and every next release conflicts. `release-source`
   refuses any other head branch.
3. **Tag and release** on the merge commit in `main`:
   `gh release create vX.Y.Z --target <merge sha> --title "SafeUnfollow vX.Y.Z"` with the
   CHANGELOG entry as notes. The release event is what Zenodo mints the version DOI from;
   cite only the concept DOI.
4. **After production deploys**: submit the URLs whose content changed (the homepages if the
   chip moved, `/docs/roadmap`) to IndexNow once, with the key in `public/`. Only changed
   URLs: the protocol asks callers not to resubmit unchanged ones, and a ping on every
   deploy is ruled out. If `/` copy changed, add the deploy date to
   `analytics/measurement-boundaries.md`.

---

## Tips for Great Release Notes

### Do's ✅

- **Focus on user benefits** - Explain "what this means for you"
- **Use emojis sparingly** - Make sections scannable
- **Include metrics** - "75x faster" is better than "much faster"
- **Link to issues** - Give credit and provide context
- **Show gratitude** - Thank contributors and community

### Don'ts ❌

- **Don't use jargon** - Avoid technical terms unless necessary
- **Don't be vague** - "Various improvements" tells users nothing
- **Don't skip breaking changes** - Always document migrations
- **Don't forget links** - Link to docs, issues, and guides
- **Don't rush** - Take time to write clear, helpful notes

---

**Remember:** Release notes are often the first thing users see. Make them count!
