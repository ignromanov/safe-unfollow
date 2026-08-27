import { GuideDialog } from '@/components/guide/GuideDialog';
import { PageLoader } from '@/components/PageLoader';
import { UploadZone } from '@/components/UploadZone';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useGuideDialog } from '@/hooks/useGuideDialog';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Upload page
 * Prerendered for SEO - shows upload zone and instructions
 */
export function Component() {
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();
  const { uploadState, handleZipUpload, parseWarnings } = useInstagramData();
  const guide = useGuideDialog();

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
      <GuideDialog
        open={guide.isOpen}
        step={guide.step}
        source={guide.source}
        onGoToStep={guide.goToStep}
        onClose={guide.close}
      />
    </>
  );
}

export default Component;
