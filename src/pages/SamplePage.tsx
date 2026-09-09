import { useEffect, useRef } from 'react';
import { AccountListSection } from '@/components/AccountListSection';
import { useSampleData } from '@/hooks/useSampleData';

/**
 * Sample data page
 * NOT prerendered - loads demo data dynamically
 */
export function Component() {
  const { load: loadSampleData, state: sampleState, data: sampleData } = useSampleData();
  const sampleLoadTriggeredRef = useRef(false);

  // Trigger sample data load on first visit
  useEffect(() => {
    if (sampleState === 'idle' && !sampleLoadTriggeredRef.current) {
      sampleLoadTriggeredRef.current = true;
      loadSampleData().catch(() => {
        sampleLoadTriggeredRef.current = false;
      });
    }
  }, [sampleState, loadSampleData]);

  // Loading state
  if (sampleState === 'loading' || sampleState === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">Loading sample data...</p>
          <p className="text-sm text-muted-foreground">Preparing 1,180 demo accounts</p>
        </div>
      </div>
    );
  }

  // Error state
  if (sampleState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to generate sample data</p>
          <button
            onClick={() => {
              sampleLoadTriggeredRef.current = false;
              loadSampleData();
            }}
            className="text-primary-strong hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Success - show sample data
  if (sampleState === 'success' && sampleData) {
    return (
      <AccountListSection
        fileHash={sampleData.fileHash}
        accountCount={sampleData.accountCount}
        filename="Sample Data (Demo)"
        isSample={true}
      />
    );
  }

  return null;
}

export default Component;
