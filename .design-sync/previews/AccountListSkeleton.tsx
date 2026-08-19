import { AccountListSkeleton } from 'safe-unfollow';

// Default row count used while the account list is loading.
export function Default() {
  return (
    <div className="max-w-md">
      <AccountListSkeleton />
    </div>
  );
}

// Fewer placeholder rows — used for a smaller expected result set.
export function Compact() {
  return (
    <div className="max-w-md">
      <AccountListSkeleton count={3} />
    </div>
  );
}
