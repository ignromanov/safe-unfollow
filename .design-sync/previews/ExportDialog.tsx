import { ExportDialog } from 'safe-unfollow';

// Real usage: AccountListSection strips the extension off the uploaded ZIP
// name before passing it down (`filename.replace(/\.[^/.]+$/, '')`), so the
// dialog always receives a bare base name, never `.zip`.
export function Default() {
  return (
    <ExportDialog
      open
      onOpenChange={() => {}}
      fileHash="preview-hash"
      indices={null}
      rowCount={214}
      filename="instagram-johndoe-20260615"
    />
  );
}

// Same dialog, a dataset near the scale the product markets ("1M+ accounts
// tested and verified") — worth a second cell so the row-count copy is seen
// with real thousands-formatting rather than a two-digit placeholder.
export function LargeDataset() {
  return (
    <ExportDialog
      open
      onOpenChange={() => {}}
      fileHash="preview-hash"
      indices={null}
      rowCount={48213}
      filename="instagram-creator-20260701"
    />
  );
}
