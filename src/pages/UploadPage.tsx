import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/PageLoader';
import { UploadZone } from '@/components/UploadZone';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useGuideDialog } from '@/hooks/useGuideDialog';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * The guide is a modal, and it was in the entry chunk for every visitor of
 * every prerendered page — GuideDialog pulls in GuideRail, GuideStepSection
 * and ResponsiveGif behind it, none of which anybody sees until they ask to
 * see it. Lazy, and mounted only once it has been opened, so a reader who
 * never opens it never downloads it.
 */
const GuideDialog = lazy(() =>
  import('@/components/guide/GuideDialog').then(m => ({ default: m.GuideDialog }))
);

/**
 * Upload page
 * Prerendered for SEO - shows upload zone and instructions
 */
export function Component() {
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();
  const { uploadState, handleZipUpload, parseWarnings } = useInstagramData();
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
      navigate(`${prefix}/results`, { replace: true });
    }
  }, [uploadState.status, navigate, prefix]);

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
