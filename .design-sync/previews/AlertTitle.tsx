// AlertTitle only renders inside <Alert>, so each cell is a full Alert composition
// that puts the title under the spotlight. Content is deliberately distinct from
// Alert.tsx's cells so the two cards do not screenshot the same thing.
import { CheckCircle2, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from 'safe-unfollow';

export function ShortTitle() {
  return (
    <div className="max-w-lg">
      <Alert>
        <CheckCircle2 aria-hidden="true" />
        <AlertTitle>Export analyzed</AlertTitle>
        <AlertDescription>3,857 accounts read from your ZIP in under two seconds.</AlertDescription>
      </Alert>
    </div>
  );
}

export function TitleOnly() {
  return (
    <div className="max-w-lg">
      <Alert>
        <WifiOff aria-hidden="true" />
        <AlertTitle>You are offline — and everything still works</AlertTitle>
      </Alert>
    </div>
  );
}

// AlertTitle carries `line-clamp-1` (src/components/ui/alert.tsx) — it is single-line
// by design and a long title truncates with an ellipsis rather than wrapping. This cell
// documents that constraint deliberately: keep titles short and put the detail in
// AlertDescription, which does wrap.
export function LongTitleClamps() {
  return (
    <div className="max-w-sm">
      <Alert variant="destructive">
        <AlertTitle>This ZIP does not contain a followers_and_following folder</AlertTitle>
        <AlertDescription>
          Re-run the export and tick only &ldquo;Followers and following&rdquo;.
        </AlertDescription>
      </Alert>
    </div>
  );
}
