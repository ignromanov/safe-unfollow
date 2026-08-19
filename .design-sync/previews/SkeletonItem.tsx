import { SkeletonItem } from 'safe-unfollow';

// A single row placeholder — meaningless alone, so shown stacked the way
// AccountList actually renders it: repeated rows inside a bordered list card.
export function StackedRows() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card overflow-hidden">
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
    </div>
  );
}
