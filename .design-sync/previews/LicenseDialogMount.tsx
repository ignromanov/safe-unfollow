import { useState } from 'react';

import { LicenseDialogMount } from 'safe-unfollow';

// LicenseDialogMount only owns the Suspense boundary + memo guard around the
// lazily-imported LicenseDialog (see the component's own doc comment for why
// memo() is load-bearing there) — `open` is forwarded straight through, so
// the one story that shows real content is the open state.
export function Default() {
  const [open, setOpen] = useState(true);
  return <LicenseDialogMount licenseKey="" open={open} onOpenChange={setOpen} />;
}
