import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useEffect } from 'react';

import { analytics } from '@/lib/analytics';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';

/**
 * RouteErrorPage - Error boundary for React Router
 *
 * Handles errors thrown during:
 * - Route rendering
 * - Loader functions
 * - Action functions
 *
 * Uses useRouteError() to get error details
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();
  const isDev = import.meta.env.DEV;

  // Track route errors in analytics
  useEffect(() => {
    if (isRouteErrorResponse(error)) {
      analytics.routeError(error.status, error.statusText);
    } else if (error instanceof Error) {
      analytics.routeError(-1, error.message);
    }
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate(`${prefix}/`);
  };

  // HTTP Error Response (404, 500, etc.)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="animate-in slide-in-from-top-4 rounded-4xl border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-8 md:p-12">
            {/* Icon */}
            <div className="mb-6 text-amber-500">
              <AlertTriangle size={48} strokeWidth={1.5} />
            </div>

            {/* Title */}
            <div className="mb-2 flex items-center gap-3">
              <AlertTriangle size={20} className="text-amber-500" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                {error.status} {error.statusText}
              </h2>
            </div>

            {/* Message */}
            <p className="mb-6 text-base font-medium leading-relaxed md:text-lg text-amber-600 dark:text-amber-300">
              {error.data || getDefaultMessage(error.status)}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleGoHome}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
              >
                <Home size={18} />
                Go Home
              </button>

              <button
                onClick={handleReload}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 px-6 py-3 text-sm font-bold text-amber-700 dark:text-amber-400 transition-all hover:bg-white/50 dark:hover:bg-black/20"
              >
                <RefreshCw size={18} />
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic JavaScript Error
  if (error instanceof Error) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="animate-in slide-in-from-top-4 rounded-4xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 p-8 md:p-12">
            {/* Icon */}
            <div className="mb-6 text-rose-500">
              <AlertTriangle size={48} strokeWidth={1.5} />
            </div>

            {/* Title */}
            <div className="mb-2 flex items-center gap-3">
              <AlertTriangle size={20} className="text-rose-500" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">
                Route Error
              </h2>
            </div>

            {/* Message */}
            <p className="mb-6 text-base font-medium leading-relaxed md:text-lg text-rose-600 dark:text-rose-300">
              {error.message || 'An unexpected error occurred while loading this page.'}
            </p>

            {/* Error details (dev only) */}
            {isDev && error.stack && (
              <div className="mb-8 rounded-2xl bg-white/60 dark:bg-black/20 p-6">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                  Stack Trace
                </h3>
                <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                  {error.stack}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleGoHome}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
              >
                <Home size={18} />
                Go Home
              </button>

              <button
                onClick={handleReload}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 px-6 py-3 text-sm font-bold text-rose-700 dark:text-rose-400 transition-all hover:bg-white/50 dark:hover:bg-black/20"
              >
                <RefreshCw size={18} />
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unknown error type
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="animate-in slide-in-from-top-4 rounded-4xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-8 md:p-12">
          {/* Icon */}
          <div className="mb-6 text-zinc-500">
            <AlertTriangle size={48} strokeWidth={1.5} />
          </div>

          {/* Title */}
          <div className="mb-2 flex items-center gap-3">
            <AlertTriangle size={20} className="text-zinc-500" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-400">
              Unknown Error
            </h2>
          </div>

          {/* Message */}
          <p className="mb-6 text-base font-medium leading-relaxed md:text-lg text-zinc-600 dark:text-zinc-400">
            An unexpected error occurred.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleGoHome}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <Home size={18} />
              Go Home
            </button>

            <button
              onClick={handleReload}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 px-6 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-400 transition-all hover:bg-white/50 dark:hover:bg-black/20"
            >
              <RefreshCw size={18} />
              Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get default message for HTTP status code
 */
function getDefaultMessage(status: number): string {
  switch (status) {
    case 404:
      return "The page you're looking for doesn't exist.";
    case 403:
      return "You don't have permission to access this page.";
    case 500:
      return 'Internal server error. Please try again later.';
    case 503:
      return 'Service temporarily unavailable.';
    default:
      return 'An error occurred while loading this page.';
  }
}
