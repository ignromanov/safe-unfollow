import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AppState } from '@/core/types';
import { analytics } from '@/lib/analytics';
import { LayoutDashboard, Moon, ShieldCheck, Sun, SunMoon, Trash2, Upload } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  hasData?: boolean;
  onViewResults?: () => void;
  onClear?: () => void;
  onUpload?: () => void;
  onLogoClick?: () => void;
  activeScreen?: AppState;
}

export function Header({
  hasData = false,
  onViewResults,
  onClear,
  onUpload,
  onLogoClick,
  activeScreen = AppState.HERO,
}: HeaderProps) {
  const { t } = useTranslation('common');
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch - theme is unknown on server
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleThemeToggle = () => {
    // Cycle: system → light → dark → system
    const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(nextTheme);
    analytics.themeToggle(nextTheme);
  };

  const handleClear = () => {
    analytics.clearData();
    onClear?.();
  };

  return (
    <header className="sticky top-0 z-[80] w-full border-b border-border bg-card md:bg-card/80 md:backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onLogoClick}
          role="button"
          tabIndex={0}
          aria-label={t('header.logoAria')}
          onKeyDown={e => e.key === 'Enter' && onLogoClick?.()}
        >
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-gradient-brand flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <span className="font-display font-extrabold text-xl md:text-2xl tracking-tight hidden sm:block">
            SafeUnfollow<span className="text-primary">.app</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {hasData ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onViewResults}
                className={`cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  activeScreen === AppState.RESULTS
                    ? 'bg-primary text-white shadow-md'
                    : 'text-zinc-500 hover:bg-[oklch(0.5_0_0_/_0.05)]'
                }`}
                aria-label={t('buttons.viewResults')}
              >
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">{t('buttons.viewResults')}</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                    title={t('header.deleteData')}
                    aria-label={t('header.deleteData')}
                  >
                    <Trash2 size={18} />
                    <span className="hidden md:inline">{t('buttons.delete')}</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-2">
                      <Trash2 size={28} className="text-rose-500" />
                    </div>
                    <AlertDialogTitle>{t('header.clearDataTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('header.clearDataDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClear}
                      className="bg-rose-500 text-white hover:bg-rose-600"
                    >
                      {t('buttons.clearData')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <button
              onClick={onUpload}
              className={`cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                activeScreen === AppState.UPLOAD
                  ? 'bg-primary text-white shadow-md'
                  : 'text-zinc-500 hover:bg-[oklch(0.5_0_0_/_0.05)]'
              }`}
              aria-label={t('buttons.uploadFile')}
            >
              <Upload size={18} />
              <span className="hidden md:inline">{t('buttons.uploadFile')}</span>
            </button>
          )}

          {/* Divider */}
          <div className="w-[1px] h-6 md:h-8 bg-border" />

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Theme Toggle */}
          {/* HYDRATION FIX: Always render the same icon (SunMoon) during SSR and initial mount.
              After mount, we can show the correct icon based on theme.
              This avoids structural mismatch (div vs svg). */}
          <button
            onClick={handleThemeToggle}
            className="cursor-pointer flex items-center justify-center p-3 md:px-3 md:py-2 rounded-2xl hover:bg-[oklch(0.5_0_0_/_0.05)] transition-colors text-zinc-500"
            title={
              mounted
                ? theme === 'system'
                  ? t('theme.system')
                  : theme === 'light'
                    ? t('theme.dark')
                    : t('theme.light')
                : t('theme.system')
            }
            aria-label={
              mounted
                ? theme === 'system'
                  ? t('theme.system')
                  : theme === 'light'
                    ? t('theme.dark')
                    : t('theme.light')
                : t('theme.system')
            }
          >
            {!mounted || theme === 'system' ? (
              <SunMoon size={20} />
            ) : theme === 'light' ? (
              <Moon size={20} />
            ) : (
              <Sun size={20} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
