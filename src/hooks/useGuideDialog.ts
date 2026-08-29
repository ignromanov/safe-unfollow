import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { GUIDE_STEPS } from '@/config/wizard-steps';

/** Where the reader came from. Not in the URL — it describes the gesture, not the state. */
export type GuideSource = 'accordion' | 'error' | 'zone' | 'url';

export interface GuideDialogState {
  isOpen: boolean;
  /** The section the URL claims, or null for "open, with no claim to a section". */
  step: number | null;
  source: GuideSource;
  open: (source: GuideSource, step?: number) => void;
  goToStep: (step: number) => void;
  close: () => void;
}

const FIRST_STEP = 1;
const LAST_STEP = GUIDE_STEPS.length;

function parseStep(raw: string | null): number | null {
  if (raw === null) return null;
  const step = Number(raw);
  return Number.isInteger(step) && step >= FIRST_STEP && step <= LAST_STEP ? step : null;
}

/**
 * The dialog's state lives in the URL, so it survives a reload, a share and
 * the Back button — and so an error screen can deep-link into a section
 * without the page having to hold state across a navigation.
 *
 * That is true of `isOpen` and `step`, and not of `source`: the URL never
 * encodes which gesture opened the dialog, because it is not state to be
 * shared or restored. It is component-instance memory, and it is reported as
 * `'url'` whenever the URL alone opened the dialog.
 *
 * Query, not path: `vite-react-ssg` prerenders paths. `?step=N` creates no
 * page, needs no canonical tag and adds nothing to the 70 prerendered files.
 *
 * `?step` outside 1..7 is not an error and does not close the dialog — it is
 * someone following a link that used to mean something, and the honest answer
 * is the guide from the start.
 */
export function useGuideDialog(): GuideDialogState {
  const location = useLocation();
  const navigate = useNavigate();

  // The source of the current opening. A URL that already carried ?step on
  // arrival was not opened by any gesture of ours, so it reads as 'url' until
  // one of our own entry points says otherwise. State, not a ref: it is read
  // during render, and every write is followed by a navigation that re-renders
  // anyway, so a ref would buy nothing and cost the render-time read.
  const [source, setSource] = useState<GuideSource>('url');

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hasStepParam = params.has('step');
  const isOpen = hasStepParam || params.get('guide') === '1';
  const step = parseStep(params.get('step'));

  const navigateWith = useCallback(
    (mutate: (next: URLSearchParams) => void, replace: boolean) => {
      const next = new URLSearchParams(location.search);
      mutate(next);
      const search = next.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace });
    },
    [location.pathname, location.search, navigate]
  );

  const open = useCallback(
    (nextSource: GuideSource, target?: number) => {
      setSource(nextSource);
      // Push exactly once, on opening. Back is how a modal is dismissed on
      // Android; with replace here the hardware Back would leave the site
      // from under someone mid-instruction. With push-once, the first Back
      // closes the dialog and the second leaves the page.
      navigateWith(next => {
        if (target === undefined) {
          next.delete('step');
          next.set('guide', '1');
        } else {
          next.delete('guide');
          next.set('step', String(target));
        }
      }, false);
    },
    [navigateWith]
  );

  const goToStep = useCallback(
    (target: number) => {
      // Replace: seven sections in one scroll would otherwise leave seven
      // history entries between the reader and the page they came from.
      navigateWith(next => {
        next.delete('guide');
        next.set('step', String(target));
      }, true);
    },
    [navigateWith]
  );

  const close = useCallback(() => {
    setSource('url');
    navigateWith(next => {
      next.delete('step');
      next.delete('guide');
    }, true);
  }, [navigateWith]);

  return {
    isOpen,
    step,
    source: isOpen ? source : 'url',
    open,
    goToStep,
    close,
  };
}
