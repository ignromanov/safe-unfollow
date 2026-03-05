import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  isFiltering?: boolean;
  processingTime?: number;
}

export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  isFiltering = false,
  processingTime,
}: SearchBarProps) {
  const { t } = useTranslation('results');
  return (
    <div className="space-y-2">
      <form role="search" onSubmit={e => e.preventDefault()}>
        <div className="relative">
          {isFiltering ? (
            <Loader2 className="absolute start-3 sm:start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground animate-spin" />
          ) : (
            <Search
              className="absolute start-3 sm:start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <Input
            id="account-search"
            type="text"
            placeholder={t('search.placeholder')}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoCorrect="off"
            autoCapitalize="none"
            inputMode="search"
            className="ps-10 pe-12 sm:pe-10 text-base h-12 sm:h-10"
            aria-label={t('search.ariaLabel')}
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
              className="absolute end-1 top-1/2 h-11 w-11 sm:h-8 sm:w-8 -translate-y-1/2 p-0"
              aria-label={t('search.clearAriaLabel')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
      {/* Screen reader announcement for search results */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {!isFiltering &&
          t('search.liveResults', {
            result: resultCount,
            total: totalCount,
            defaultValue: '{{result}} of {{total}} accounts match your search',
          })}
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <p>
          {t('search.resultsCount', {
            result: resultCount.toLocaleString(),
            total: totalCount.toLocaleString(),
          })}
          <span className="hidden sm:inline"> {t('search.accounts')}</span>
        </p>
        {processingTime !== undefined && processingTime > 0 && !isFiltering && (
          <p className="text-xs">
            {t('search.time', { time: processingTime < 1 ? '<1' : Math.round(processingTime) })}
          </p>
        )}
      </div>
    </div>
  );
}
