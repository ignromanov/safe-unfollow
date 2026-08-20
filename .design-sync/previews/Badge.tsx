import { Badge } from 'safe-unfollow';

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Mutuals</Badge>
      <Badge variant="secondary">Following</Badge>
      <Badge variant="destructive">Recently unfollowed</Badge>
      <Badge variant="outline">Pending request</Badge>
    </div>
  );
}

export function AccountBadges() {
  return (
    <div className="flex max-w-md flex-wrap items-center gap-2">
      <Badge variant="secondary">Followers</Badge>
      <Badge variant="secondary">Following</Badge>
      <Badge>Mutuals</Badge>
      <Badge variant="destructive">Recently unfollowed</Badge>
      <Badge variant="outline">Not following back</Badge>
      <Badge variant="outline">Not followed back</Badge>
      <Badge variant="outline">Restricted</Badge>
      <Badge variant="outline">Close friend</Badge>
    </div>
  );
}
