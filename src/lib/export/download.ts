/**
 * Triggers a browser download for a generated export Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Deferred: Safari aborts an in-flight download when the object URL is
  // revoked in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
