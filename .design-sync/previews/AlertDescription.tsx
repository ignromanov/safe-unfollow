// AlertDescription only renders inside <Alert>. Each cell is a full Alert whose
// description is the subject — short, long, and multi-element bodies — with content
// distinct from Alert.tsx and AlertTitle.tsx.
import { Clock, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from 'safe-unfollow';

export function ShortBody() {
  return (
    <div className="max-w-lg">
      <Alert>
        <Clock aria-hidden="true" />
        <AlertTitle>Still preparing</AlertTitle>
        <AlertDescription>
          Meta usually takes 5&ndash;30 minutes to build your ZIP.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function LongBody() {
  return (
    <div className="max-w-lg">
      <Alert>
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>Your data never leaves this device</AlertTitle>
        <AlertDescription>
          The ZIP is unpacked by a Web Worker in your own browser and the results are written to
          IndexedDB, which is sandboxed per browser profile. There is no upload step, no account,
          and no server that could hold a copy &mdash; which is also why clearing your browser data
          removes the analysis and you would need to re-upload the export.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function StructuredBody() {
  return (
    <div className="max-w-lg">
      <Alert variant="destructive">
        <AlertTitle>We could not read this export</AlertTitle>
        <AlertDescription>
          <p>Two things usually cause this:</p>
          <ul className="mt-2 space-y-1">
            <li>The format was set to HTML instead of JSON.</li>
            <li>The download only included Stories, not Followers and following.</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
