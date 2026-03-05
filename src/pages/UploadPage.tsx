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

  const handleOpenWizard = () => {
    navigate(`${prefix}/wizard/step/6`);
  };

  return (
    <UploadZone
      onUploadStart={handleUploadStart}
      onOpenWizard={handleOpenWizard}
      isProcessing={uploadState.status === 'loading'}
      parseWarnings={parseWarnings}
    />
  );
}

export default Component;
