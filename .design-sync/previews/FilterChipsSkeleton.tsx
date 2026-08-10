import { FilterChipsSkeleton } from 'safe-unfollow';

// No props — a fixed row of pill placeholders shown while badge filters load.
export function Default() {
  return (
    <div className="max-w-md">
      <FilterChipsSkeleton />
    </div>
  );
}
