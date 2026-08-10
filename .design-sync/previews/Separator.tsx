import { Separator } from 'safe-unfollow';

export function SectionDivider() {
  return (
    <div className="max-w-md space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Account overview</h3>
        <p className="text-sm text-muted-foreground">1,842 followers, 2,015 following</p>
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold">Recently unfollowed</h3>
        <p className="text-sm text-muted-foreground">96 accounts stopped following you</p>
      </div>
    </div>
  );
}

export function InlineStats() {
  return (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>1,842 Followers</span>
      <Separator orientation="vertical" />
      <span>2,015 Following</span>
      <Separator orientation="vertical" />
      <span>96 Unfollowed</span>
    </div>
  );
}
