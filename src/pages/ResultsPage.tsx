import { AccountListSection } from '@/components/AccountListSection';
import { DiagnosticErrorScreen } from '@/components/DiagnosticErrorScreen';
import { Hero } from '@/components/Hero';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { useResultsFile } from '@/hooks/useResultsFile';
import { useStoreSSR } from '@/hooks/useStoreSSR';
import { useNavigate } from 'react-router-dom';

/**
 * Results page (account list)
 *
 * This page IS prerendered, contrary to what this comment said until GH#49's follow-up:
 * `dist/results.html` is emitted on every build and `vercel.json` carries no rewrite for
 * `/results`, so with `cleanUrls` that file is what a visitor is served and what React
 * hydrates against. It is built from an empty store, so every store read here goes
 * through `useStoreSSR` and renders the no-data branch while hydrating — by construction,
 * not by relying on zustand persist's undocumented `getInitialState` pinning.
 *
 * The visible flip that follows for a returning visitor (Hero replaced by the account
 * list one pass later) is GH#44, and is not fixed here.
 */
export function Component() {
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  const resultsFile = useResultsFile();
  const uploadStatus = useStoreSSR(s => s.uploadStatus, 'idle');
  const uploadError = useStoreSSR(s => s.uploadError, null);

  // Fallback handler for the DiagnosticErrorScreen's "open wizard" action.
  // The Hero fallback below navigates on its own via real anchors.
  const handleStartGuide = () => {
    navigate(`${prefix}/wizard`);
  };

  const handleTryAgain = () => {
    navigate(`${prefix}/upload`);
  };

  // Show error if upload failed
  if (uploadStatus === 'error') {
    return (
      <DiagnosticErrorScreen
        errorMessage={uploadError || 'An error occurred while processing your file.'}
        onTryAgain={handleTryAgain}
        onOpenWizard={handleStartGuide}
      />
    );
  }

  // Show results if data available
  if (resultsFile) {
    return (
      <AccountListSection
        fileHash={resultsFile.fileHash!}
        accountCount={resultsFile.accountCount!}
        filename={resultsFile.name}
        isSample={false}
      />
    );
  }

  // Fallback to Hero if no data
  return <Hero hasData={false} />;
}

export default Component;
