import type { BadgeKey } from '@/core/types';
import { memo } from 'react';
import type { ReactNode } from 'react';

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  colorClass: string;
  badgeType?: BadgeKey;
  isActive: boolean;
  onClick: (type: BadgeKey) => void;
}

export const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  colorClass,
  badgeType,
  isActive,
  onClick,
}: StatCardProps) {
  return (
    <button
      onClick={() => badgeType && onClick(badgeType)}
      className={`p-5 md:p-6 rounded-3xl border transition-all flex flex-col items-start gap-3 md:gap-4 text-left group w-full ${
        isActive
          ? 'bg-primary border-primary shadow-lg scale-[1.02]'
          : 'bg-card border-border hover:border-primary/50 shadow-sm'
      }`}
      aria-label={`${isActive ? 'Remove' : 'Add'} ${label} filter`}
      aria-pressed={isActive}
      disabled={!badgeType}
    >
      <div
        className={`p-2.5 rounded-xl transition-transform ${
          isActive ? 'bg-white/20 text-white' : `${colorClass} group-hover:scale-110`
        }`}
      >
        {icon}
      </div>
      <div className="space-y-0.5 md:space-y-1">
        <div
          className={`text-xl md:text-3xl font-display font-black tracking-tight leading-none ${
            isActive ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {value.toLocaleString()}
        </div>
        <div
          className={`text-xs font-black uppercase tracking-widest leading-none ${
            isActive ? 'text-white/80' : 'text-zinc-400'
          }`}
        >
          {label}
        </div>
      </div>
    </button>
  );
});
