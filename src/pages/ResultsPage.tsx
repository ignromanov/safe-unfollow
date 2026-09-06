import { AccountListSection } from '@/components/AccountListSection';
import { DiagnosticErrorScreen } from '@/components/DiagnosticErrorScreen';
import { Hero } from '@/components/Hero';
import { ResultsSkeleton } from '@/components/ResultsSkeleton';
import { useFilterFromUrl } from '@/hooks/useFilterFromUrl';
import { useIsClient } from '@/hooks/useIsClient';
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
 * "No data yet" and "no data at all" are different pages, and until GH#44 they were the
 * same branch. Both the prerender and the first client pass answer the first question —
 * nobody has read the store yet — and that answer is `ResultsSkeleton`. The Hero answers
 * the second, and is reached only once hydration has run and there is genuinely nothing
 * to show.
 */
export function Component() {
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  const isClient = useIsClient();
  const resultsFile = useResultsFile();
  const uploadStatus = useStoreSSR(s => s.uploadStatus, 'idle');
  const uploadError = useStoreSSR(s => s.uploadError, null);

  // Above every early return below, because a hook cannot live behind one and this page
  // has three. Harmless during the prerender: effects do not run under SSG, so the
  // parameter is read on the client at hydration — the first frame that could show a
  // list — and there is no unfiltered flash to design around.
  useFilterFromUrl();

  const handleTryAgain = () => {
    navigate(`${prefix}/upload`);
  };

  // Before hydration nobody has read the store, so no branch below can be answered yet.
  // Stated as its own guard rather than left to fall through the ones underneath: those
  // reach this same conclusion only because their `serverValue`s happen to be falsy today.
  if (!isClient) {
    return <ResultsSkeleton />;
  }

  // Show error if upload failed
  if (uploadStatus === 'error') {
    return (
      <DiagnosticErrorScreen
        errorMessage={uploadError || 'An error occurred while processing your file.'}
        onTryAgain={handleTryAgain}
        // Presence-only: DiagnosticErrorScreen uses this to decide whether to
        // render its wizard link, whose own href — not this callback — navigates.
        onOpenWizard={() => {}}
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

  // Hydrated, and there is genuinely nothing to show.
  return <Hero hasData={false} />;
}

export default Component;
