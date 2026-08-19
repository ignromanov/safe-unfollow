import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function BetweenGroups() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Filter badges</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>Mutuals</DropdownMenuItem>
        <DropdownMenuItem>Not following back</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Recently unfollowed</DropdownMenuItem>
        <DropdownMenuItem>Dismissed</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BeforeDestructive() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Account actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Open profile</DropdownMenuItem>
        <DropdownMenuItem>Copy username</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">Dismiss</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
