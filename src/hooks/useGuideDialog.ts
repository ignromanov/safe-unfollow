import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';

import { GUIDE_STEPS } from '@/config/wizard-steps';

/**
 * Where the reader came from. Not in the URL — it describes the gesture, not
 * the state.
 *
 * A runtime list with the type derived from it, rather than a union with a
 * second copy of its members written out for the guard below. `source` is a
 * categorical column in the analytics database, so a member set that can drift
 * from its own guard does not fail — it silently grows a fifth arm on a
 * four-arm breakdown. Adding a source here binds the guard the same day.
 */
export const GUIDE_SOURCES = ['accordion', 'error', 'zone', 'url'] as const;

export type GuideSource = (typeof GUIDE_SOURCES)[number];

/**
 * Router state naming the gesture that pushed this entry, for a pusher that is
 * an anchor — `open()` never runs for those, so nothing else can tell the
 * arrival apart from a plain URL visit.
 *
 * Deliberately its own shape rather than a field only `SamePathPushState` may
 * carry. "This entry names a gesture" and "this entry was pushed onto the path
 * the reader already stood on" are two different facts, and the diagnostic
 * error screen produces both combinations: on `/upload` its CTA stays on the
 * path, on `/results` the same component's same button leaves it. Welding the
 * two together is what made the second report `'url'` — half of one surface
 * landing in the bucket the other three arms are measured against.
 */
export interface GuideSourceState {
  source: GuideSource;
}

/**
 * Router state on a history entry that a link pushed onto the path the reader
 * was already standing on, so closing the dialog has an entry of its own to pop.
 *
 * The pusher has to declare it, because nothing downstream can work it out.
 * `useNavigationType()` reports PUSH both for `/upload` -> `/upload?step=N` and
 * for `/` -> `/upload?guide=1`, and the History API does not expose the previous
 * entry's path; popping the second would take the reader off the site.
 *
 * A same-path pusher may also name its gesture, so the two shapes compose —
 * but neither implies the other, and a cross-path pusher must send
 * `GuideSourceState` alone: claiming a same-path push it did not make would
 * pop the reader off the page they navigated from.
 */
export interface SamePathPushState extends Partial<GuideSourceState> {
  pushedOntoSamePath: true;
}

/** What a same-path pusher hands to `<Link state>`. */
export const SAME_PATH_PUSH: SamePathPushState = { pushedOntoSamePath: true };

function wasPushedOntoSamePath(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Partial<SamePathPushState>).pushedOntoSamePath === true
  );
}

function isGuideSource(value: unknown): value is GuideSource {
  return typeof value === 'string' && (GUIDE_SOURCES as readonly string[]).includes(value);
}

/**
 * The gesture the entry names, if it names one this hook declares — whatever
 * else the entry carries.
 *
 * Validated rather than cast, on the precedent `cta-capture.ts` sets for its
 * own slugs: an unrecognised one is discarded rather than passed on to become
 * an unlisted value. Two things make it worth the three lines here. `source`
 * is a categorical column, so an unlisted string does not fail — it reaches
 * the database as a fifth arm of a four-arm breakdown, which is this event's
 * whole subject one layer down. And `location.state` is `history.state`, which
 * outlives the page life that wrote it, so this is a boundary whose data is
 * older than the code reading it.
 *
 * The gate widened when naming was decoupled from `pushedOntoSamePath`: any
 * entry carrying a `source` is now read, not only one that also declared a
 * same-path push. There is one producer today and it is typed — this is for
 * the second one.
 */
function namedSource(state: unknown): GuideSource | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const named = (state as { source?: unknown }).source;
  return isGuideSource(named) ? named : undefined;
}

/**
 * The same entry state with its gesture name taken out, for the replace that
 * consumes it. Everything else is copied across untouched — `pushedOntoSamePath`
 * above all, which `close()` reads to decide pop-vs-replace. `null` rather than
 * an empty object when nothing else was there, so a consumed entry is
 * indistinguishable from one that never carried state.
 */
function stateWithoutSource(state: unknown): unknown {
  if (typeof state !== 'object' || state === null) return state;
  const { source: _source, ...rest } = state as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : null;
}

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
 * `source`'s two channels (the `source` state below, and `location.state` for
 * a pusher that is an anchor — see `GuideSourceState`) are a deliberate
 * split, not an accident to collapse into one. The alternative considered was
 * folding both into `location.state`, so `open()` writes there too instead of
 * keeping its own `useState`. That fails the paragraph above: browser session
 * history keeps `history.state` across a full reload (confirmed against
 * `createBrowserHistory`'s own init path, which reads `window.history.state`
 * back on load), so a `source` written into router state would survive an F5
 * the same way `isOpen`/`step` do — making an accordion-opened dialog report
 * `'accordion'` again after a reload where nothing was clicked, breaking the
 * "not restorable" guarantee this paragraph states. Keeping `source` as
 * ephemeral component state, read only where `location.state` names nothing
 * itself, is what keeps that guarantee true for the `open()` path while still
 * letting an anchor push (which cannot call `open()`) name its own gesture.
 *
 * The anchor channel is restorable by construction, for exactly the reason
 * that paragraph rejects it for `open()` — so it is CONSUMED on arrival
 * rather than merely read: the gesture is copied into ephemeral memory and
 * the entry is rewritten, once, without it (`consume the anchor's mark`
 * below). A reload of that same entry then finds nothing to restore and
 * reports `'url'`, which is the honest answer — the gesture happened in a
 * previous page life. Without it the four `source` values are not counted
 * under one rule: `'error'` would count arrivals on an entry while
 * `'accordion'`, `'zone'` and `'url'` count gestures, and no column in the
 * data would show the difference.
 *
 * Query, not path: `vite-react-ssg` prerenders paths. `?step=N` creates no
 * page, needs no canonical tag and adds nothing to the prerendered files —
 * 70 of them, a count `architecture-facts.test.ts` derives and asserts rather
 * than a number to copy. It read "160" here until this branch corrected it,
 * which is why it now cites its source instead of restating one.
 *
 * `?step` outside the guide's numbering is not an error and does not close
 * the dialog — it is
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

  // Whether our own open() pushed the entry the dialog is standing on. A ref,
  // not state: writing it must never itself trigger a re-render, and it has
  // to survive the navigation that follows the write. Read during render
  // (below, for `effectiveSource`) — but only ever WRITTEN from event
  // handlers (open(), close()) and the effect further down, never from render
  // itself. That split matters under `v7_startTransition` (main.tsx runs
  // every navigation inside one): a render can be computed and then
  // discarded without committing, and a plain read discarded along with it
  // costs nothing, but a WRITE made during such a render would persist even
  // though the render never became visible — the same class of window
  // close()'s own comment below names for the double-pop it used to allow.
  const pushedRef = useRef(false);

  // The gesture the arrival's own entry named, once taken from it. Ephemeral,
  // like `source` above and for the same reason — but a channel of its own,
  // because `source` is only trusted where pushedRef says open() wrote it, and
  // an anchor push never runs open().
  //
  // It exists because the entry stops naming the gesture the moment the effect
  // below consumes it, while the reader of `source` can arrive later than that:
  // GuideDialog is lazy and mounts only once the chunk has downloaded (see
  // UploadPage's `everOpened` latch), so on the first opening of a session the
  // consume lands first. Reading location.state alone would then report 'url'
  // for the very click this channel exists to name. Written only from effects,
  // read during render — the same discipline pushedRef's comment above states,
  // and for the same v7_startTransition reason.
  const anchorSourceRef = useRef<GuideSource | null>(null);

  // The entry a pop has already been issued from. The entry itself, not a
  // boolean: it has to survive the navigation, and it has to stop being true
  // once the reader is somewhere else — a later arrival on the same URL is a
  // different location object and pops normally.
  const poppedFromRef = useRef<Location | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hasStepParam = params.has('step');
  const isOpen = hasStepParam || params.get('guide') === '1';
  const step = parseStep(params.get('step'));

  // `isOpen` as of the last render, for detecting the true "was open, now is
  // not" transition below — see pushedRef's reset for why a plain `!isOpen`
  // check is not safe here.
  const wasOpenRef = useRef(isOpen);

  const navigateWith = useCallback(
    (mutate: (next: URLSearchParams) => void, replace: boolean) => {
      const next = new URLSearchParams(location.search);
      mutate(next);
      const search = next.toString();
      // Carry the entry's state across. goToStep replaces, and a replace that
      // dropped it would erase a SAME_PATH_PUSH mark: the reader picks a
      // section in the rail, and close() quietly reverts to replacing.
      navigate(`${location.pathname}${search ? `?${search}` : ''}`, {
        replace,
        state: location.state,
      });
    },
    [location.pathname, location.search, location.state, navigate]
  );

  const open = useCallback(
    (nextSource: GuideSource, target?: number) => {
      setSource(nextSource);
      // Push exactly once, on opening. Back is how a modal is dismissed on
      // Android; with replace here the hardware Back would leave the site
      // from under someone mid-instruction. With push-once, the first Back
      // closes the dialog and the second leaves the page.
      pushedRef.current = true;
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
      // Replace: one scroll holding every section would otherwise leave a
      // history entry per section between the reader and the page they came
      // from.
      navigateWith(next => {
        next.delete('guide');
        next.set('step', String(target));
      }, true);
    },
    [navigateWith]
  );

  const close = useCallback(() => {
    setSource('url');
    // Pop the entry the dialog stands on, rather than replacing it. A replace
    // would leave two adjacent entries for the same page — the one below,
    // without the dialog, and the one on top with the query stripped — so the
    // reader's next Back would land on a visually identical page and appear to
    // do nothing. Dismissing with the hardware Back never reaches here: that
    // pops the entry itself and the URL closes the dialog.
    //
    // Two things can have pushed that entry and only one of them is ours:
    // open(), which sets pushedRef, and a link on this same path carrying
    // SAME_PATH_PUSH. The second is not reachable through the ref — an anchor
    // navigates without running any handler of ours (PrefixedLink), which is
    // why DiagnosticErrorScreen's CTA declares the push instead.
    //
    // One pop per entry, latched on the entry rather than on a flag that the
    // next line clears. `pushedRef.current = false` used to be the whole
    // guard, and it worked only while the ref was the only arm: a second
    // close() arriving before the router commits the pop reads a
    // location.state that still carries the mark, so both calls would pop and
    // the reader would land two entries back, off /upload. main.tsx runs the
    // pop inside a React transition (v7_startTransition), which is what makes
    // that window wide enough to hit.
    if (poppedFromRef.current === location) {
      return;
    }
    if (pushedRef.current || wasPushedOntoSamePath(location.state)) {
      poppedFromRef.current = location;
      pushedRef.current = false;
      navigate(-1);
      return;
    }
    // Nothing pushed this entry: the reader arrived on ?guide=1 or ?step=N
    // from another page — the landing page or the docs — so the dialog is on
    // the entry they came in on and popping it would leave the site.
    navigateWith(next => {
      next.delete('step');
      next.delete('guide');
    }, true);
  }, [location, navigate, navigateWith]);

  // pushedRef is the only thing that tells the source below to trust `source`
  // state over whatever the entry carries — and a hardware or browser Back
  // never runs close(), the only place that used to clear it. Without this,
  // open('accordion') followed by a Back left pushedRef.current true for the
  // life of the mount, so a later arrival on an anchor that names 'error' in
  // location.state was shadowed by the stale 'accordion' — a real defect
  // (reproduced and fixed in this branch), not a hypothetical one, because it
  // fails to a plausible value rather than a broken one.
  //
  // An effect, not a plain `if` in the render body: an effect only runs for a
  // render that actually committed, so a render React computes and then
  // discards without committing (reachable under `v7_startTransition`, which
  // main.tsx wraps every navigation in — see close()'s own comment above for
  // the double-pop this same window used to allow) can never leave this
  // reset behind for a commit that never happened. A render-time write would
  // not have that guarantee.
  //
  // Gated on the wasOpenRef.current -> !isOpen TRANSITION, not on plain
  // `!isOpen`: open()'s own `setSource`/`pushedRef.current = true` can commit
  // one render ahead of the router's own location update, and that
  // intermediate commit still has the OLD (closed) `isOpen`. Because the
  // effect's dependency (`isOpen`) has not changed on that commit, React
  // skips re-running it — the flag `open()` had just set survives. A plain
  // `if (!isOpen)` (with no transition-gating) does not get this for free:
  // it would fire on that same intermediate commit and undo the flag moments
  // after `open()` set it, for `source` and, worse, for close()'s
  // pop-vs-replace decision, which reads the same ref.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      pushedRef.current = false;
      // Same reason, one channel over: nothing else clears the anchor's mark
      // once the opening it named is over, and a hardware Back never reaches
      // close(). Left behind, it would name the gesture of a previous opening
      // for a later arrival that named none.
      anchorSourceRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Consume the anchor's mark: take the gesture off the entry and keep it in
  // memory instead, so it cannot be restored into a later page life. See the
  // docstring above for why that matters — `history.state` survives a reload,
  // and a restored mark would make one arm of a four-arm breakdown count
  // arrivals while the other three count gestures.
  //
  // One replace per opening, not one per render: the replace removes the very
  // thing this effect tests for, so the next run finds nothing and returns.
  // It cannot re-fire guide_open either — GuideDialog gates that on its own
  // closed -> open edge and the URL does not change here, so `open` stays true
  // across the replace.
  //
  // Replace, not push, and the rest of the state copied across: `close()`
  // reads `pushedOntoSamePath` off this entry to decide pop-vs-replace, and a
  // push would insert an entry between the reader and the page they came from.
  // Gated on `isOpen` because the mark names the gesture that opened THIS
  // dialog; an entry carrying one with the dialog shut names nothing anyone
  // reports. An entry naming something `namedSource` does not recognise is
  // left exactly as it is — it is not ours to rewrite, and it reports 'url'
  // either way.
  useEffect(() => {
    if (!isOpen) return;
    const named = namedSource(location.state);
    if (named === undefined) return;
    anchorSourceRef.current = named;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: stateWithoutSource(location.state),
    });
  }, [isOpen, location, navigate]);

  // An anchor push (DiagnosticErrorScreen's CTA) never runs open(), so
  // pushedRef stays false and `source` state is stale — the arrival's own
  // location.state is what names the gesture, when it names one at all, until
  // the effect above takes it off the entry and into anchorSourceRef.
  // Both are read, in that order, because the render that first sees the
  // arrival runs before that effect commits.
  // pushedRef.current true means open() itself set `source`, and that this
  // opening has not since been closed — see the reset above — which takes
  // precedence over whatever the entry happens to carry.
  const effectiveSource = pushedRef.current
    ? source
    : (namedSource(location.state) ?? anchorSourceRef.current ?? 'url');

  return {
    isOpen,
    step,
    source: isOpen ? effectiveSource : 'url',
    open,
    goToStep,
    close,
  };
}
