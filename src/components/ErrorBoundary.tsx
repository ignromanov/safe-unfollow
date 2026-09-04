import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

import { analytics } from '@/lib/analytics';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch React render errors
 *
 * Catches errors in:
 * - Component render
 * - Lifecycle methods
 * - Hooks (useState, useEffect, etc.)
 *
 * Does NOT catch:
 * - Event handlers (use try-catch)
 * - Async code (use try-catch or .catch())
 * - Server-side rendering errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Track error in analytics
    analytics.errorBoundary(error.message, errorInfo.componentStack || '');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI (internal use only)
 */
const DefaultErrorFallback = ({ error }: { error: Error | null }) => {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Error card */}
        <div className="animate-in slide-in-from-top-4 rounded-4xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 p-8 md:p-12">
          {/* Icon */}
          <div className="mb-6 text-rose-500">
            <AlertTriangle size={48} strokeWidth={1.5} />
          </div>

          {/* Title */}
          <div className="mb-2 flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-500" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">
              Something went wrong
            </h2>
          </div>

          {/* Message */}
          <p className="mb-6 text-base font-medium leading-relaxed md:text-lg text-rose-600 dark:text-rose-300">
            The application encountered an unexpected error. Please try reloading the page.
          </p>

          {/* Error details (dev only) */}
          {isDev && error && (
            <div className="mb-8 rounded-2xl bg-white/60 dark:bg-black/20 p-6">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                Error Details
              </h3>
              <p className="text-sm font-mono text-rose-600 dark:text-rose-400 mb-2">
                {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => window.location.reload()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <RefreshCw size={18} />
              Reload Page
            </button>

            <button
              onClick={() => (window.location.href = '/')}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 px-6 py-3 text-sm font-bold text-rose-700 dark:text-rose-400 transition-all hover:bg-white/50 dark:hover:bg-black/20"
            >
              <Home size={18} />
              Go Home
            </button>
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
            What happened?
          </h4>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            The app crashed due to an unexpected error. Your data is safe - everything is stored
            locally in your browser. Reloading the page should fix the issue.
          </p>
        </div>
      </div>
    </div>
  );
};
