import { AccountList } from '@/components/AccountList';
import resultsEN from '@/locales/en/results.json';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

// The only mock this file needs: the hook reads IndexedDB, which jsdom does not
// provide. Everything else — the virtualizer, the icons, the copy — runs real,
// because the empty branch is what is under test and it renders none of them.
//
// i18n comes from the GLOBAL mock (`vitest.setup.ts:5`), deliberately, and not
// from `createI18nMock`: the global one replaces every occurrence of a token and
// understands `{{count, number}}`, which is what production i18next does. The
// opt-in mock replaces the first occurrence only, so an assertion written
// against it can pass while the live page renders a raw `{{…}}`.
vi.mock('@/hooks/useAccountDataSource', () => ({
  useAccountDataSource: vi.fn(() => ({
    getAccount: vi.fn(),
  })),
}));

/**
 * Task 5. "No accounts match" invites the reading that the tool is broken. The
 * empty list has to say which filter produced it and offer removing it, in that
 * order — and it must not speak for an export it has not read.
 */
describe('empty state', () => {
  type ActiveFilter = { label: string };

  const emptyList = (activeFilter?: ActiveFilter, searchActive = false) => (
    <AccountList
      fileHash="h"
      accountCount={100}
      accountIndices={[]}
      hasLoadedData
      isLoading={false}
      activeFilter={activeFilter}
      searchActive={searchActive}
      onClearFilters={vi.fn()}
    />
  );

  const applied: ActiveFilter = { label: resultsEN.badges.pending };

  it('should name the filter that emptied the list', () => {
    render(emptyList(applied));

    expect(
      screen.getByText(
        resultsEN.empty.filteredTitle.replace('{{filterName}}', resultsEN.badges.pending)
      )
    ).toBeInTheDocument();
  });

  it('should offer one tap out of the filter', async () => {
    const onClearFilters = vi.fn();
    render(
      <AccountList
        fileHash="h"
        accountCount={100}
        accountIndices={[]}
        hasLoadedData
        isLoading={false}
        activeFilter={applied}
        searchActive={false}
        onClearFilters={onClearFilters}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: resultsEN.filters.removeOne.replace('{{label}}', resultsEN.badges.pending),
      })
    );

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  /**
   * Control, green before this task and after it.
   *
   * Not a copy nicety: the button is wired to `handleClearFilters`, which does
   * `setFilters(new Set())` AND `setQuery('')`. "Remove Pending request filter"
   * is a false description of what the tap does whenever a search is active,
   * because it also empties the search box. A `toHaveBeenCalledTimes(1)`
   * assertion cannot see that difference; the label is the only thing that can.
   */
  it('should not promise to remove only the filter when a search is also active', () => {
    render(emptyList(applied, true));

    expect(screen.getByRole('button', { name: resultsEN.empty.resetFilters })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: resultsEN.filters.removeOne.replace('{{label}}', resultsEN.badges.pending),
      })
    ).not.toBeInTheDocument();
  });

  /**
   * The empty state may name the filter and nothing else.
   *
   * A count of 0 cannot say whether the badge's file was in the download:
   * `storeAllAccounts` seeds an entry for every badge in `ALL_BADGES` with
   * `count: 0` and writes them unconditionally (`indexeddb-service.ts:194-254`),
   * so `getBadgeStats` returns 0 both for "the file was absent" and for "the
   * file was there and you have none". Measured, not inferred: it returns all
   * 11 keys. Any sentence about the export is therefore unmeasured, whichever
   * way it leans.
   *
   * Derived from the bundle rather than typed out: this iterates every
   * `empty.*` string, so a re-added `absentTitle` or `absentBody` is caught
   * without anyone remembering to add it here.
   */
  it('should claim nothing about the export beyond naming the filter', () => {
    render(emptyList({ label: resultsEN.badges.pending }));

    const interpolate = (s: string) =>
      s
        .replace('{{filterName}}', resultsEN.badges.pending)
        .replace('{{label}}', resultsEN.badges.pending);

    const title = interpolate(resultsEN.empty.filteredTitle);
    expect(screen.getByText(title)).toBeInTheDocument();

    const allowed = new Set([title, resultsEN.empty.resetFilters]);
    for (const value of Object.values(resultsEN.empty)) {
      const rendered = interpolate(value);
      if (allowed.has(rendered)) continue;
      expect(screen.queryByText(rendered)).not.toBeInTheDocument();
    }
  });

  /** Control: an empty export with no filter applied must not be told a filter emptied it. */
  it('should keep the neutral message when no filter is applied', () => {
    render(emptyList(undefined));

    expect(screen.getByText(resultsEN.empty.noUsers)).toBeInTheDocument();
  });
});
