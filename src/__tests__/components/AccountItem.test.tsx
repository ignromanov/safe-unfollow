import { AccountItem, type AccountItemProps } from '@/components/AccountItem';
import type { BadgeMap, DateZones } from '@/core/types';
import { createFollowDateFormatter } from '@/lib/follow-dates';
import { fireEvent, render, screen } from '@testing-library/react';

// 'UTC' keeps the assertions independent of the CI machine's TZ.
const fmt = createFollowDateFormatter('en', 'UTC');
const Z: DateZones = { following: 'local', followers: 'local' };

const row = (badges: BadgeMap, over: Partial<AccountItemProps> = {}) =>
  render(
    <AccountItem
      account={{ username: 'a', badges }}
      index={0}
      totalCount={1}
      dateZones={Z}
      formatDate={fmt}
      reserveDateLine
      {...over}
    />
  );

describe('AccountItem date line', () => {
  it('shows the following line with the day only', () => {
    row({ following: 1727654400 });
    expect(screen.getByText('Following since Sep 30, 2024')).toBeInTheDocument();
  });

  it('promise 1: no time of day', () => {
    const { container } = row({ following: 1727654400 + 18 * 3600 + 32 * 60 });
    expect(container.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('promise 2: no date for a badge the row does not carry', () => {
    const { container } = row({ followers: true }, { dateZones: { following: 'local' } });
    expect(container.textContent).not.toMatch(/since|\d{4}/);
  });

  it('promise 3: no unfollowed, restricted, close or dismissed line', () => {
    const { container } = row(
      { unfollowed: 1, restricted: 2, close: 3, dismissed: 4 },
      {
        dateZones: {
          unfollowed: 'utc',
          restricted: 'utc',
          close: 'utc',
          dismissed: 'utc',
          following: 'utc',
        },
      }
    );
    expect(container.textContent).not.toMatch(/since|sent|\d{4}/);
  });

  it('promise 4: an undated row keeps an empty box; a pre-PR-2 row has no box and no digits', () => {
    const undated = row({ following: true });
    expect(undated.container.querySelector('p')?.textContent).toBe('');
    undated.unmount();
    const old = row({ following: 1727654400 }, { dateZones: null, reserveDateLine: false });
    expect(old.container.querySelector('p')).toBeNull();
    expect(old.container.textContent).not.toMatch(/\d{4}/);
  });

  it('the click payload carries badge keys only, never a date', () => {
    const onAccountClick = vi.fn();
    row({ following: 1727654400, followers: true }, { onAccountClick });
    fireEvent.click(screen.getByRole('article'));
    expect(onAccountClick).toHaveBeenCalledWith(['following', 'followers']);
  });
});
