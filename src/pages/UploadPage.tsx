import { PageLoader } from '@/components/PageLoader';
import { UploadZone } from '@/components/UploadZone';
import { useInstagramData } from '@/hooks/useInstagramData';
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
    handleZipUpload(file);
  };

  const handleBack = () => {
    // Use browser history to go back to the actual previous page
    // (could be / if user clicked "I have my file", or /wizard if from guide)
    navigate(-1);
  };

  const handleOpenWizard = () => {
    navigate(`${prefix}/wizard/step/6`);
  };

  return (
    <UploadZone
      onUploadStart={handleUploadStart}
      onBack={handleBack}
      onOpenWizard={handleOpenWizard}
      isProcessing={uploadState.status === 'loading'}
      error={uploadState.error}
      parseWarnings={parseWarnings}
    />
  );
}

export default Component;
