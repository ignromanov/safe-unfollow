import { useStoreSSR } from '@/hooks/useStoreSSR';

import type { FileMetadata } from '@/core/types';

/**
 * The analysed file, if one is loaded and complete enough to render a list from.
 *
 * `fileHash` and `accountCount` are optional on `FileMetadata` and both are required to
 * mount `AccountListSection`, so "a file exists" and "a file can be rendered" are not the
 * same question. `useHasResults` answers the first (should the header offer results at
 * all); this answers the second. They can disagree for a success record that carries no
 * hash — filed as a follow-up rather than silently changed here.
 *
 * Returns `null` while hydrating, because every page ships prerendered from an empty
 * store. See `useStoreSSR`.
 */
export function useResultsFile(): FileMetadata | null {
  const file = useStoreSSR(s => s.fileMetadata, null);
  const status = useStoreSSR(s => s.uploadStatus, 'idle');

  if (status !== 'success' || file === null) return null;
  if (!file.fileHash || typeof file.accountCount !== 'number') return null;

  return file;
}
