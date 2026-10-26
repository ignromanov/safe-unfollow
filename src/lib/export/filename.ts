export type ExportExtension = 'html' | 'csv' | 'json';

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * The one name every export gets. It is built from the download day alone: the uploaded
 * ZIP is named by Meta after the account owner's username, so deriving from it would put
 * the owner's name on a file the reader may share. Local getters, because the day the
 * reader sees on their own calendar is the day they expect in the name.
 */
export function exportFilename(
  extension: ExportExtension,
  options: { sample: boolean; now?: Date }
): string {
  const now = options.now ?? new Date();
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `safeunfollow-${day}${options.sample ? '-sample' : ''}.${extension}`;
}
