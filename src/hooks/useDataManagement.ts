import { dbCache } from '@/lib/indexeddb/indexeddb-cache';
import { useAppStore } from '@/lib/store';
import { useCallback } from 'react';

export function useDataManagement() {
  const clearData = useAppStore(s => s.clearData);
  const setUploadInfo = useAppStore(s => s.setUploadInfo);

  const handleClearData = useCallback(async () => {
    clearData();
    setUploadInfo({
      currentFileName: null,
      uploadStatus: 'idle',
      uploadError: null,
      fileSize: undefined,
      uploadDate: undefined,
    });

    // Clear IndexedDB cache
    try {
      await dbCache.clear();
    } catch (error) {
      console.error('[IndexedDB] Failed to clear cache:', error);
    }

    // Remove legacy cross-session upload marker if present, preserving umami-opt-out
    try {
      localStorage.removeItem('analytics_last_upload');
    } catch {
      // localStorage may be unavailable (private browsing / restricted storage)
    }
  }, [clearData, setUploadInfo]);

  return {
    handleClearData,
  };
}
