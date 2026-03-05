import { memo } from 'react';

export const SkeletonItem = memo(function SkeletonItem() {
  return (
    <div className="flex items-center justify-between px-6 py-6 border-b border-border animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-muted" />
        <div className="space-y-2">
          <div className="h-4 md:h-5 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
      </div>
    </div>
  );
});
