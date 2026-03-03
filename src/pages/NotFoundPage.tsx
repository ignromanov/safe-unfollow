import { Search, Home } from 'lucide-react';
import { useEffect } from 'react';

import { analytics } from '@/lib/analytics';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';

/**
 * NotFoundPage - 404 page for unknown routes
 *
 * Shows when user navigates to non-existent route.
 * Uses <a href> instead of <button onClick> to work before React hydration
 * (important for Vercel's static 404.html fallback).
 */
export function Component() {
  const prefix = useLanguagePrefix();

  // Track 404 page views
  useEffect(() => {
    analytics.pageView();
  }, []);

  return (
    <div className="min-h-[calc(100dvh-200px)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="animate-in slide-in-from-top-4 rounded-4xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="mb-6 text-zinc-400 flex justify-center">
            <Search size={64} strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-display font-bold text-zinc-900 dark:text-white mb-4">
            404
          </h1>

          <h2 className="text-lg md:text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Page Not Found
          </h2>

          {/* Message */}
          <p className="mb-8 text-base font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>

          {/* Action - using <a> for pre-hydration functionality */}
          <a
            href={`${prefix}/`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
          >
            <Home size={20} />
            Go to Home
          </a>
        </div>

        {/* Helpful links - using <a> for pre-hydration functionality */}
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
            Helpful Links
          </h4>
          <ul className="space-y-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <li>
              <a href={`${prefix}/wizard`} className="hover:text-primary transition-colors">
                → How to get Instagram data
              </a>
            </li>
            <li>
              <a href={`${prefix}/upload`} className="hover:text-primary transition-colors">
                → Upload your data
              </a>
            </li>
            <li>
              <a href={`${prefix}/sample`} className="hover:text-primary transition-colors">
                → Try with sample data
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Component;
