import { AccountListSection } from '@/components/AccountListSection';
import { DiagnosticErrorScreen } from '@/components/DiagnosticErrorScreen';
import { Hero } from '@/components/Hero';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { useNavigate } from 'react-router-dom';

/**
 * Results page (account list)
 * NOT prerendered - requires user data from IndexedDB
 * Falls back to Hero if no data available
 */
export function Component() {
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();
  const { uploadState, fileMetadata } = useInstagramData();

  const hasResults =
    uploadState.status === 'success' &&
    fileMetadata !== null &&
    Boolean(fileMetadata.fileHash) &&
    typeof fileMetadata.accountCount === 'number';

  // Fallback handler for the DiagnosticErrorScreen's "open wizard" action.
  // The Hero fallback below navigates on its own via real anchors.
  const handleStartGuide = () => {
    navigate(`${prefix}/wizard`);
  };

  const handleTryAgain = () => {
    navigate(`${prefix}/upload`);
  };

  // Show error if upload failed
  if (uploadState.status === 'error') {
    return (
      <DiagnosticErrorScreen
        errorMessage={uploadState.error || 'An error occurred while processing your file.'}
        onTryAgain={handleTryAgain}
        onOpenWizard={handleStartGuide}
      />
    );
  }

  // Show results if data available
  if (hasResults && fileMetadata) {
    return (
      <AccountListSection
        fileHash={fileMetadata.fileHash!}
        accountCount={fileMetadata.accountCount!}
        filename={fileMetadata.name}
        isSample={false}
      />
    );
  }

  // Fallback to Hero if no data
  return <Hero hasData={false} />;
}

export default Component;
