import { BADGE_STYLES } from '@/constants/badge-styles';
import type { AccountBadges, BadgeKey } from '@/core/types';
import { User } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface AccountItemProps {
  account: AccountBadges;
  index: number;
  totalCount: number;
  onAccountClick?: (badges: string[]) => void;
}

export const AccountItem = memo(function AccountItem({
  account,
  index,
  totalCount,
  onAccountClick,
}: AccountItemProps) {
  const { t } = useTranslation('results');

  const handleClick = () => {
    if (!onAccountClick) return;
    const activeBadges = (Object.entries(account.badges) as [BadgeKey, boolean][])
      .filter(([, active]) => active)
      .map(([key]) => key);
    onAccountClick(activeBadges);
  };

  const profileUrl = `https://instagram.com/${account.username}`;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex items-center justify-between px-5 md:px-8 py-4 md:py-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors border-b border-border last:border-0 no-underline text-inherit"
      role="article"
      aria-posinset={index + 1}
      aria-setsize={totalCount}
    >
      {/* Avatar + Info */}
      <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-grow">
        <div className="w-11 h-11 md:w-16 md:h-16 shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-border">
          <User size={24} />
        </div>
        <div className="min-w-0 flex-grow">
          <span className="font-display font-bold text-base md:text-2xl truncate text-zinc-900 dark:text-white mb-1.5 md:mb-2 leading-tight block hover:text-primary transition-colors">
            @{account.username}
          </span>
          {/* Horizontal Badge Scroll on Mobile */}
          <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {Object.entries(account.badges)
              .filter(([, hasBadge]) => hasBadge)
              .map(([badgeKey]) => (
                <span
                  key={badgeKey}
                  className={`shrink-0 text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-lg border leading-none ${
                    BADGE_STYLES[badgeKey] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t(`badges.${badgeKey as BadgeKey}`)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </a>
  );
});
