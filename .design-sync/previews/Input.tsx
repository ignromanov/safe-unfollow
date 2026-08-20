import { Search } from 'lucide-react';
import { Input } from 'safe-unfollow';

export function SearchEmpty() {
  return (
    <div className="relative max-w-sm">
      <Search
        className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="text"
        placeholder="Search usernames..."
        className="ps-10"
        aria-label="Search accounts by username"
      />
    </div>
  );
}

export function SearchFilled() {
  return (
    <div className="relative max-w-sm">
      <Search
        className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="text"
        defaultValue="maria.gonzalez"
        className="ps-10"
        aria-label="Search accounts by username"
      />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="max-w-sm">
      <Input type="text" defaultValue="travel.with.sam" disabled />
    </div>
  );
}
