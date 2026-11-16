/**
 * The export modal a reader asked for, kept across the reload that a failed chunk causes.
 *
 * The export modals are lazy chunks, and on iOS their import can fail mid-session while the
 * chunk is live (22 `error_boundary` events, 2026-10-30 → 11-16). stale-chunk-recovery answers
 * with one reload, which works — but the reloaded page knew nothing of the click, so the reader
 * had to find the button again, and the free sample they had already saved could be built a
 * second time if they did.
 *
 * Written when a modal is asked for, erased once it has mounted. Whatever survives a reload is
 * therefore exactly a modal that was asked for and never drawn. `sessionStorage`, because the
 * reload keeps the tab and nothing else should: another tab, or tomorrow, is a different visit.
 */
const STORE_KEY = 'export-resume';

/** What the paywall says about the sample on disk — the same shape the controls hold. */
export interface SavedSample {
  filename: string;
  total: number;
  capped: boolean;
}

export type ExportResume =
  | { modal: 'paywall'; fileHash: string; saved: SavedSample }
  | { modal: 'export'; fileHash: string };

export function rememberExportModal(resume: ExportResume): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(resume));
  } catch {
    // Storage refused: the reload still happens, the reader just clicks again.
  }
}

export function forgetExportModal(): void {
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing was stored if storage refuses, so there is nothing to forget.
  }
}

function isSavedSample(value: unknown): value is SavedSample {
  if (typeof value !== 'object' || value === null) return false;
  const sample = value as Record<string, unknown>;
  return (
    typeof sample.filename === 'string' &&
    typeof sample.total === 'number' &&
    typeof sample.capped === 'boolean'
  );
}

function parse(raw: string): ExportResume | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { modal, fileHash, saved } = value as Record<string, unknown>;
  if (typeof fileHash !== 'string') return null;
  if (modal === 'export') return { modal, fileHash };
  if (modal === 'paywall' && isSavedSample(saved)) return { modal, fileHash, saved };
  return null;
}

/**
 * The modal to reopen for this file, consumed on read. Another file's intent is left in place
 * rather than consumed: the results page can mount before it knows which file it shows.
 */
export function takeExportResume(fileHash: string): ExportResume | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const resume = parse(raw);
  if (resume?.fileHash !== fileHash) return null;
  forgetExportModal();
  return resume;
}
