import type { BadgeKey, FileDiscovery, FileMetadata, ParseWarning } from '@/core/types';
import type { SupportedLanguage } from '@/locales';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Re-export for backwards compatibility
export type { SupportedLanguage };

interface AppState {
  filters: Set<BadgeKey>;
  currentFileName: string | null;
  uploadStatus: 'idle' | 'loading' | 'success' | 'error';
  uploadError: string | null;
  fileMetadata: FileMetadata | null;
  // i18n language state
  language: SupportedLanguage;
  // Session-only state (not persisted)
  parseWarnings: ParseWarning[];
  fileDiscovery: FileDiscovery | null;
  _hasHydrated: boolean;
  setFilters: (filters: Set<BadgeKey>) => void;
  setUploadInfo: (info: {
    currentFileName?: string | null;
    uploadStatus?: 'idle' | 'loading' | 'success' | 'error';
    uploadError?: string | null;
    fileSize?: number;
    uploadDate?: Date;
    fileHash?: string;
    accountCount?: number;
    parseWarnings?: ParseWarning[];
    fileDiscovery?: FileDiscovery;
  }) => void;
  clearData: () => void;
  // Language action
  setLanguage: (lang: SupportedLanguage) => void;
}

// Helper to serialize Set for persist
function serializeSet<T extends string | number>(set: Set<T>): T[] {
  return Array.from(set.values());
}
function deserializeSet<T>(arr: T[] | undefined): Set<T> {
  return new Set(arr ?? []);
}

const STORE_KEY = 'unfollow-radar-store';

/**
 * Synchronously persist language to localStorage.
 *
 * IMPORTANT: Call this BEFORE navigation when changing language.
 * Zustand persist writes asynchronously (microtask), so the page would reload
 * before localStorage updates, causing the redirect script in index.html
 * to read the OLD language value.
 *
 * @param lang - Language to persist
 */
export function persistLanguageSync(lang: SupportedLanguage): void {
  console.log('[persistLanguageSync] Called with:', lang);
  try {
    const stored = localStorage.getItem(STORE_KEY);
    console.log('[persistLanguageSync] Current localStorage:', stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state) {
        parsed.state.language = lang;
        const newValue = JSON.stringify(parsed);
        console.log('[persistLanguageSync] Writing:', newValue);
        localStorage.setItem(STORE_KEY, newValue);
        console.log('[persistLanguageSync] After write:', localStorage.getItem(STORE_KEY));
      }
    } else {
      // No existing store - create minimal structure
      const newValue = JSON.stringify({
        state: { language: lang },
        version: 5,
      });
      console.log('[persistLanguageSync] Creating new:', newValue);
      localStorage.setItem(STORE_KEY, newValue);
    }
  } catch (e) {
    console.log('[persistLanguageSync] Error:', e);
    // localStorage unavailable (private mode, quota exceeded)
  }
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      filters: new Set<BadgeKey>(),
      currentFileName: null,
      uploadStatus: 'idle',
      uploadError: null,
      fileMetadata: null,
      language: 'en' as SupportedLanguage,
      parseWarnings: [],
      fileDiscovery: null,
      _hasHydrated: false,
      setFilters: filters => set({ filters: new Set(filters) }),
      setUploadInfo: info =>
        set(state => {
          const newState: Partial<AppState> = {
            currentFileName: info.currentFileName ?? state.currentFileName,
            uploadStatus: info.uploadStatus ?? state.uploadStatus,
            uploadError: info.uploadError ?? state.uploadError,
            parseWarnings: info.parseWarnings ?? state.parseWarnings,
            fileDiscovery: info.fileDiscovery ?? state.fileDiscovery,
          };

          // Update fileMetadata when we have file info and success status
          if (info.currentFileName && info.uploadStatus === 'success') {
            newState.fileMetadata = {
              name: info.currentFileName,
              size: info.fileSize || 0,
              uploadDate: info.uploadDate || new Date(),
              fileHash: info.fileHash,
              accountCount: info.accountCount,
            };
          }

          // Clear fileMetadata on error
          if (info.uploadStatus === 'error') {
            newState.fileMetadata = null;
          }

          return newState;
        }),
      clearData: () =>
        set({
          currentFileName: null,
          uploadStatus: 'idle',
          uploadError: null,
          fileMetadata: null,
          parseWarnings: [],
          fileDiscovery: null,
          filters: new Set<BadgeKey>(),
        }),
      setLanguage: (lang: SupportedLanguage) => {
        // Only update store for persistence
        // i18n is synced with URL by useLanguageFromPath, not by store
        set({ language: lang });
      },
    }),
    {
      name: STORE_KEY,
      version: 5, // Version 5: Remove journey state
      migrate: (persistedState: unknown, version: number) => {
        // If version is 4 or older, migrate to v5 (remove journey)
        if (version <= 4) {
          if (typeof persistedState === 'object' && persistedState !== null) {
            const state = persistedState as Record<string, unknown>;
            // Remove journey field if it exists
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { journey, ...cleanState } = state;
            // Ensure language exists (added in v4)
            return {
              ...cleanState,
              language: cleanState.language || 'en',
              _hasHydrated: false,
            };
          }
          // Fallback: return fresh state
          return {
            filters: new Set<BadgeKey>(),
            currentFileName: null,
            uploadStatus: 'idle' as const,
            uploadError: null,
            fileMetadata: null,
            language: 'en',
            _hasHydrated: false,
          };
        }

        // For future versions, return the persisted state as-is
        return persistedState;
      },
      partialize: state =>
        ({
          filters: serializeSet(state.filters),
          currentFileName: state.currentFileName,
          uploadStatus: state.uploadStatus,
          uploadError: state.uploadError,
          fileMetadata: state.fileMetadata,
          // Language IS persisted - used for redirect from language-less paths
          // URL remains the source of truth for current rendering
          language: state.language,
        }) as unknown as Partial<AppState>,
      onRehydrateStorage: () => state => {
        if (state) {
          state._hasHydrated = true;
          // Language IS restored from localStorage for redirect purposes
          // But URL remains the source of truth for current rendering (i18n)
        }
      },
      storage: {
        getItem: name => {
          try {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const json = JSON.parse(str);
            if (Array.isArray(json.state?.filters)) {
              json.state.filters = deserializeSet(json.state.filters);
            }
            return json;
          } catch {
            // localStorage unavailable (private mode, quota exceeded)
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            const val = { ...value } as Record<string, unknown>;
            const state = val.state as Record<string, unknown> | undefined;
            if (state?.filters instanceof Set) {
              state.filters = serializeSet(state.filters);
            }
            localStorage.setItem(name, JSON.stringify(val));
          } catch {
            // localStorage unavailable (private mode, quota exceeded)
          }
        },
        removeItem: name => {
          try {
            localStorage.removeItem(name);
          } catch {
            // localStorage unavailable (private mode, quota exceeded)
          }
        },
      },
    }
  )
);
