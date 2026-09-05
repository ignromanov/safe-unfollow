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
  type ActiveFilter = { label: string; presentInExport: boolean | null };

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

  const present: ActiveFilter = { label: resultsEN.badges.pending, presentInExport: true };
  const absent: ActiveFilter = { label: resultsEN.badges.pending, presentInExport: false };
  const unmeasured: ActiveFilter = { label: resultsEN.badges.pending, presentInExport: null };

  it('should name the filter that emptied the list', () => {
    render(emptyList(present));

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
        activeFilter={present}
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
    render(emptyList(present, true));

    expect(screen.getByRole('button', { name: resultsEN.empty.resetFilters })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: resultsEN.filters.removeOne.replace('{{label}}', resultsEN.badges.pending),
      })
    ).not.toBeInTheDocument();
  });

  it('should not claim the export says something it does not carry', () => {
    render(emptyList(absent));

    expect(
      screen.getByText(
        resultsEN.empty.absentTitle.replace('{{filterName}}', resultsEN.badges.pending)
      )
    ).toBeInTheDocument();
    // What stops an implementation that renders both explanations at once.
    expect(screen.queryByText(resultsEN.empty.filteredBody)).not.toBeInTheDocument();
  });

  /**
   * The third state, and the one that goes red if `presentInExport` is typed
   * `boolean`. `filterCounts` is `{}` until `getBadgeStats` resolves
   * (`useAccountFiltering.ts:248-256`), so a missing key means "no answer yet",
   * not "zero". Collapse null into false and this renders `absentTitle` about a
   * badge the export contains; collapse it into true and it renders "that is
   * what this export says". Both are claims about the reader's own data that
   * nothing has measured.
   */
  it('should say nothing about the export before the counts have arrived', () => {
    render(emptyList(unmeasured));

    // The filter is named — that much is true of an empty list either way.
    expect(
      screen.getByText(
        resultsEN.empty.filteredTitle.replace('{{filterName}}', resultsEN.badges.pending)
      )
    ).toBeInTheDocument();

    // But neither explanation is offered, because neither has been measured.
    expect(
      screen.queryByText(
        resultsEN.empty.absentTitle.replace('{{filterName}}', resultsEN.badges.pending)
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(resultsEN.empty.filteredBody)).not.toBeInTheDocument();
    expect(screen.queryByText(resultsEN.empty.absentBody)).not.toBeInTheDocument();
  });

  /** Control: an empty export with no filter applied must not be told a filter emptied it. */
  it('should keep the neutral message when no filter is applied', () => {
    render(emptyList(undefined));

    expect(screen.getByText(resultsEN.empty.noUsers)).toBeInTheDocument();
  });
});
