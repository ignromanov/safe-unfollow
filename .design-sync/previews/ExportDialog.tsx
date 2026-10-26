import { ExportDialog } from 'safe-unfollow';

// The dialog names the file itself (`exportFilename`: download date only, never
// the account owner), so there is no file name to pass in.
export function Default() {
  return (
    <ExportDialog
      open
      onOpenChange={() => {}}
      fileHash="preview-hash"
      indices={null}
      rowCount={214}
      totalCount={214}
      filters={[]}
      searchApplied={false}
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
      rowCount={61240}
      totalCount={61240}
      filters={[]}
      searchApplied={false}
    />
  );
}
