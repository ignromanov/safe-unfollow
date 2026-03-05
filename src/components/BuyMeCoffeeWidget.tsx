import { useEffect, useRef, useCallback, useState } from 'react';

const BMC_STORAGE_KEY = 'bmc_widget_shown_v1';
const BMC_SCRIPT_ID = 'bmc-script';
const BMC_WIDGET_ID = 'bmc-wbtn';

interface BuyMeCoffeeWidgetProps {
  /** Show the widget (controls mounting/unmounting) */
  show: boolean;
  /** Delay before expanding the panel (ms) */
  expandDelay?: number;
  /** Auto-collapse after this time (ms), 0 = don't collapse */
  autoCollapseAfter?: number;
  /** Skip localStorage check (for sample data - show every session) */
  skipStorageCheck?: boolean;
}

/**
 * BuyMeACoffee widget with dynamic script loading.
 *
 * Features:
 * - Loads BMC script only when `show=true`
 * - Removes script and widget on unmount (page navigation)
 * - Timer resets on unmount (navigation cancels pending expand)
 * - localStorage persistence (optional via skipStorageCheck)
 */
export function BuyMeCoffeeWidget({
  show,
  expandDelay = 30000,
  autoCollapseAfter = 10000,
  skipStorageCheck = false,
}: BuyMeCoffeeWidgetProps) {
  // Prevent hydration mismatch - this component is client-only
  const [mounted, setMounted] = useState(false);
  const hasExpandedRef = useRef(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cleanup = useCallback(() => {
    // Clear timers
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    // Remove script
    const script = document.getElementById(BMC_SCRIPT_ID);
    if (script) {
      script.remove();
    }

    // Remove widget button
    const widget = document.getElementById(BMC_WIDGET_ID);
    if (widget) {
      widget.remove();
    }

    // Remove any BMC iframes
    const iframes = document.querySelectorAll('iframe[title*="BMC"]');
    iframes.forEach(iframe => iframe.remove());
  }, []);

  useEffect(() => {
    // Don't run until mounted (client-side only)
    if (!mounted) return;

    if (!show) {
      cleanup();
      return;
    }

    // Always load BMC script when show=true (displays the icon)
    loadBMCScript();

    // Check localStorage with 30-day TTL (unless skipped for sample data) — only for auto-expand
    if (!skipStorageCheck) {
      try {
        const stored = localStorage.getItem(BMC_STORAGE_KEY);
        if (stored) {
          const shownAt = parseInt(stored, 10);
          if (!isNaN(shownAt) && Date.now() - shownAt < 30 * 24 * 60 * 60 * 1000) {
            return; // Skip auto-expand within 30-day TTL, but icon is already loaded
          }
        }
      } catch {
        // localStorage unavailable (private mode, quota exceeded)
      }
    }

    // Don't auto-expand if inline donation card was shown this session
    try {
      if (sessionStorage.getItem('donation_card_shown')) return;
    } catch {
      // sessionStorage unavailable
    }

    // Don't re-expand in same session
    if (hasExpandedRef.current) return;

    // Set expand timer
    expandTimerRef.current = setTimeout(() => {
      expandBMCWidget();
      hasExpandedRef.current = true;

      // Save to localStorage (only for non-sample)
      if (!skipStorageCheck) {
        try {
          localStorage.setItem(BMC_STORAGE_KEY, String(Date.now()));
        } catch {
          // localStorage unavailable (private mode, quota exceeded)
        }
      }

      // Auto-collapse
      if (autoCollapseAfter > 0) {
        collapseTimerRef.current = setTimeout(() => {
          collapseBMCWidget();
        }, autoCollapseAfter);
      }
    }, expandDelay);

    // Cleanup on unmount or when show changes to false
    return cleanup;
  }, [mounted, show, expandDelay, autoCollapseAfter, skipStorageCheck, cleanup]);

  return null;
}

/**
 * Load BMC script dynamically into document head
 */
function loadBMCScript(): void {
  // Don't load twice
  if (document.getElementById(BMC_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = BMC_SCRIPT_ID;
  script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
  script.async = true;
  script.setAttribute('data-name', 'BMC-Widget');
  script.setAttribute('data-id', 'ignromanov');
  script.setAttribute('data-description', 'Free Instagram tracker. Your data stays local.');
  script.setAttribute('data-message', 'If it helped, a coffee keeps it free.');
  script.setAttribute('data-color', '#6366F1');
  script.setAttribute('data-position', 'left');
  script.setAttribute('data-x_margin', '18');
  script.setAttribute('data-y_margin', '18');

  script.onload = () => {
    // BMC script self-initializes on DOMContentLoaded. In an SPA the document
    // is already loaded so that event never fires again. Instead of dispatching
    // a synthetic DOMContentLoaded (which can trigger unrelated listeners),
    // use a MutationObserver to confirm the widget rendered.
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.getElementById(BMC_WIDGET_ID)) {
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // BMC 1.0.0 checks readyState and calls init immediately if "complete"
    // If that didn't work, nudge it with a DOMContentLoaded on document only
    // (scoped — not window — to minimize side-effects)
    if (!document.getElementById(BMC_WIDGET_ID)) {
      const evt = new Event('DOMContentLoaded', { bubbles: false, cancelable: false });
      document.dispatchEvent(evt);
    }

    // Safety: disconnect observer after 5s regardless
    setTimeout(() => observer.disconnect(), 5000);
  };

  document.head.appendChild(script);
}

/**
 * Expand the BMC widget panel by clicking the button
 */
function expandBMCWidget(): void {
  const widget = document.getElementById(BMC_WIDGET_ID);
  if (widget) {
    const button = widget.querySelector('button') || widget;
    if (button instanceof HTMLElement) {
      button.click();
    }
  }
}

/**
 * Collapse the BMC widget panel
 */
function collapseBMCWidget(): void {
  const widget = document.getElementById(BMC_WIDGET_ID);
  if (widget) {
    const button = widget.querySelector('button') || widget;
    if (button instanceof HTMLElement) {
      button.click();
    }
  }
}
