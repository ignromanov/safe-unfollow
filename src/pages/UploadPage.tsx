import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/PageLoader';
import { UploadZone } from '@/components/UploadZone';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useGuideDialog } from '@/hooks/useGuideDialog';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The guide is a modal, and it was in the entry chunk for every visitor of
 * every prerendered page — GuideDialog pulls in GuideRail, GuideStepSection
 * and ResponsiveGif behind it, none of which anybody sees until they ask to
 * see it. Lazy, and mounted only once it has been opened, so a reader who
 * never opens it never downloads it.
 */
const importGuideDialog = () =>
  import('@/components/guide/GuideDialog').then(m => ({ default: m.GuideDialog }));

/**
 * No retry here, and the absence is deliberate: `.catch(importGuideDialog)`
 * stood in this line and could not recover the transient fetch it named.
 *
 * A second `import()` of the same specifier does not re-fetch. The browser's
 * module map records a failed fetch against the (url, type) pair, and later
 * imports of that specifier settle from the map without a request going out
 * (normative specification behaviour, reasoned about here rather than
 * measured: no browser test was run against a failing chunk) — so the retry
 * re-delivered the stored rejection. Nor could it have reached a second fetch
 * by another route: Vite's preload helper makes only CSS deps rejectable (a
 * `modulepreload` link for a JS chunk resolves to `undefined`),
 * this chunk's deps are all JS because the single stylesheet is imported from
 * `main.tsx` and lands in the entry, and the helper's `seen` map means a repeat
 * call creates no link either. React asks once regardless: `lazyInitializer`
 * runs the factory only while the payload is Uninitialized, and a rejected
 * payload re-throws its stored error for the life of the module (react 18.3.1).
 *
 * What does work on a chunk that will not load is a reload — Vite dispatches
 * `vite:preloadError` for exactly that. It is not wired up, because nothing
 * here has measured how often the case arises, and the failure is already
 * handled rather than merely dropped: see the ErrorBoundary below, which keeps
 * the uploader working while the guide stays shut. The `?step=N` / `?guide=1`
 * the reader clicked stays in the URL through all of it — the only control
 * that clears it is `guide.close`, wired below into the dialog that did not
 * mount — which is also what makes a reload of that URL the recovery.
 */
const GuideDialog = lazy(importGuideDialog);

/**
 * Upload page
 * Prerendered for SEO - shows upload zone and instructions
 */
export function Component() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useLanguagePrefix();
  const { uploadState, handleZipUpload, handleClearData, parseWarnings } = useInstagramData();
  const guide = useGuideDialog();
  // Latches on the first open and never clears. Set during render rather
  // than from an effect: React re-runs this component before committing, so
  // the dialog mounts in the same pass the reader asked for it, with no
  // wasted frame in between.
  const [everOpened, setEverOpened] = useState(false);
  if (guide.isOpen && !everOpened) setEverOpened(true);

  // Auto-navigate to results after successful upload
  useEffect(() => {
    if (uploadState.status === 'success') {
      // The reader chose this filter by clicking a page about it. A multi-second
      // parse and a route change sit between that click and the view, and
      // re-applying it by hand at the other end is the whole point of the
      // landing page not landing.
      // Both parameters survive, and only they: the filter is what the reader
      // asked to see, and the source is the only thing that will ever say which
      // page asked. Forwarding the whole query instead would ship this page's own
      // `?guide=1` / `?step=N` to a page that has no guide on it.
      // No validation here — the hook at the other end owns the badge list, and
      // two copies of it is the defect CLAUDE.md bans.
      const incoming = new URLSearchParams(location.search);
      const carried = new URLSearchParams();
      const filter = incoming.get('filter');
      const from = incoming.get('from');
      if (filter) carried.set('filter', filter);
      if (from) carried.set('from', from);
      const suffix = carried.toString();
      navigate(`${prefix}/results${suffix ? `?${suffix}` : ''}`, { replace: true });
    }
  }, [uploadState.status, navigate, prefix, location.search]);

  // Show loader during redirect to prevent flash of upload page
  if (uploadState.status === 'success') {
    return <PageLoader />;
  }

  const handleUploadStart = (file: File) => {
    // handleZipUpload already reports failures through uploadState (read
    // above); it also rejects its promise so callers that await it can react.
    // This caller is fire-and-forget, so the rejection must be caught here or
    // it surfaces as an uncaught promise rejection for an already-handled error.
    handleZipUpload(file).catch(() => {});
  };

  // No navigate: the guide is a dialog on this page now, and the URL it
  // writes is a query on this same path.
  const handleOpenWizard = () => guide.open('zone');

  return (
    <>
      <UploadZone
        onUploadStart={handleUploadStart}
        onOpenWizard={handleOpenWizard}
        onOpenGuide={step => guide.open('accordion', step)}
        onCancel={handleClearData}
        isProcessing={uploadState.status === 'loading'}
        parseWarnings={parseWarnings}
      />
      {/* Kept mounted after the first open, rather than unmounted on close:
          `open={false}` is what lets Radix play the closing animation, and
          tearing the subtree out instead would make the dialog vanish. The
          chunk is already downloaded by then, so this costs nothing. */}
      {everOpened && (
        /* Suspense does NOT catch a rejected lazy import — React re-throws it
           on the next render, and without a boundary here the nearest one is
           the route's `errorElement` in routes.tsx. A guide chunk that 404s
           (a stale service-worker precache after a deploy is the ordinary
           case, not an exotic one) would then replace the whole /upload route
           — UploadZone, file picker and all — with a generic error page,
           taking down the product's actual function because a modal failed to
           download. This branch is what makes that reachable at scale:
           /docs/* and the FAQ now point at /upload?guide=1, so the chunk
           loads at hydration for cold external arrivals.

           fallback={null} rather than a message: a message needs copy in ten
           locales and this branch ships none, and an uploader that still
           works is worth more than telling someone the guide did not open.
           Not silent either — ErrorBoundary.componentDidCatch reports it
           through analytics.errorBoundary. */
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <GuideDialog
              open={guide.isOpen}
              step={guide.step}
              source={guide.source}
              onGoToStep={guide.goToStep}
              onClose={guide.close}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

export default Component;
