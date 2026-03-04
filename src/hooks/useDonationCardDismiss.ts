import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'donation_card_dismissed';
const TTL_DAYS = 14;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

interface DismissState {
  dismissedAt: number;
}

function getIsDismissed(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;

  try {
    const state: DismissState = JSON.parse(stored);
    if (Date.now() - state.dismissedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

export function useDonationCardDismiss() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(getIsDismissed());
  }, []);

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') return;

    const state: DismissState = { dismissedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setIsDismissed(true);
  }, []);

  return { isDismissed, dismiss };
}
