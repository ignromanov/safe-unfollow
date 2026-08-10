import { Button } from 'safe-unfollow';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Analyze my export</Button>
      <Button variant="secondary">Load sample data</Button>
      <Button variant="destructive">Clear all data</Button>
      <Button variant="outline">Back to guide</Button>
      <Button variant="ghost">Skip for now</Button>
      <Button variant="link">How do I export my data?</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Upload your ZIP</Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Enabled</Button>
      <Button disabled>Processing…</Button>
      <Button variant="outline" disabled>
        Unavailable
      </Button>
      <Button variant="destructive" disabled>
        Clear all data
      </Button>
    </div>
  );
}
