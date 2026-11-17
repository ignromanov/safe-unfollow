## Contributing to Instagram Unfollow Tracker

Thank you for your interest in contributing! This project is privacy-first and fully client-side, built with **IndexedDB v2** for handling massive datasets (1M+ accounts) efficiently.

**Outside code changes are not being accepted right now.** Bug reports, feature requests and
questions are welcome in [GitHub Issues](https://github.com/ignromanov/safe-unfollow/issues).

The project is licensed under `AGPL-3.0-only` (see [LICENSE](LICENSE)). Versions up to and
including v1.7.0 were released under the MIT License.

### Development Setup

**Requirements**:

- Node.js 18+ recommended
- Modern browser with IndexedDB support (Chrome 90+, Firefox 88+, Safari 15+)

**Install and run**:

```bash
npm install
npm run dev
```

**Run tests**:

```bash
npm run test              # Run all tests
npm run test:coverage     # With coverage report
npm run test:performance  # Performance benchmarks
```

**Type checking and code quality**:

```bash
npm run type-check        # TypeScript validation
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix issues
npm run code:check        # Full quality check (lint + type + unused code)
```

**Git hooks (Husky)**:

- Pre-commit hooks automatically run linting and type checking
- Pre-push hooks run tests to ensure code quality

### Branching and PRs

- Create a feature branch from `develop` and open the PR against `develop` (squash merge).
- `main` is the release branch: it moves only by a release PR from `develop` (merge commit),
  or by a `hotfix/*` branch that is merged back into `develop` afterwards. Production deploys
  from `main`.
- Keep PRs focused and small when possible.
- Include tests for new logic, and update docs when behavior changes.
- Link related issues in the PR description.

### Commit messages

- Use clear commit messages focused on the "why" and the user impact.

### Code Style & Architecture

**TypeScript + React**:

- Prefer clear names, early returns, and small components
- Use strict TypeScript (`strict: true` in tsconfig.json)
- Follow existing patterns in the codebase

**State Management**:

- **Zustand**: Only lightweight UI state (~1 KB max)
  - ✅ Allowed: `filters`, `fileMetadata`, `uploadStatus`
  - ❌ Forbidden: `unified`, `parsed`, large arrays
- **IndexedDB**: All account data in columnar format
- Never store large datasets in Zustand or localStorage

**Performance Guidelines**:

- Use IndexedDB for data storage (not Zustand/localStorage)
- Implement lazy loading for lists >50 items
- Use TanStack Virtual for virtualization
- Prefer bitsets for set operations
- Add performance tests for critical paths

**Testing**:

- Add Vitest tests for new logic (parsing, filtering, IndexedDB operations)
- Mock IndexedDB for unit tests, use real DB for integration
- Include performance assertions where applicable
- Aim for 95%+ coverage on new code

### Reporting issues

- Use the issue templates to provide reproduction steps, expected/actual behavior, and environment details.
- Check [Troubleshooting Guide](docs/troubleshooting.md) and [FAQ](docs/faq.md) first.

### Documentation

**Key Documents**:

- [README.md](README.md) - Project overview and quick start
- [INDEXEDDB_ARCHITECTURE.md](INDEXEDDB_ARCHITECTURE.md) - Storage architecture (v2)
- [FILTER_OPTIMIZATION.md](FILTER_OPTIMIZATION.md) - Performance optimization guide
- [User Guide](docs/user-guide.md) - End-user documentation
- [FAQ](docs/faq.md) - Common questions
- [Troubleshooting](docs/troubleshooting.md) - Problem solving

**When to Update Docs**:

- Performance-impacting changes → update FILTER_OPTIMIZATION.md
- IndexedDB schema changes → update INDEXEDDB_ARCHITECTURE.md
- API surface changes → update relevant docs
- New features → update User Guide and FAQ
- Design system changes → update .claude/prompts/design-system.md
- Architecture changes → update CLAUDE.md

### Performance Benchmarks

When contributing performance improvements:

**Run benchmarks**:

```bash
npm run test:performance
```

**Expected targets** (1M accounts):

- Filter (single badge): <5ms
- Filter (3 badges AND): <5ms
- Search (indexed): <2ms
- Memory usage: <10 MB
- Storage: <10 MB

**Before/after measurements**:

- Include performance metrics in PR description
- Use Chrome DevTools Performance profiler
- Test with 100k, 500k, and 1M account datasets

### Security

- Please do not open public issues for security reports. See SECURITY.md.
- All data processing happens locally in the browser
- No external network requests during data processing
- IndexedDB is origin-private and sandboxed

### Privacy Guidelines

- **Never** add telemetry, analytics, or tracking
- **Never** send user data to external services
- **Never** require Instagram authentication
- All features must work 100% offline after initial load
