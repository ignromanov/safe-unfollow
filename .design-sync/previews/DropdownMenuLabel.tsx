import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function SingleLabel() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">EN</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        <DropdownMenuItem>English</DropdownMenuItem>
        <DropdownMenuItem>Deutsch</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupedLabels() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Filter badges</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Following</DropdownMenuLabel>
        <DropdownMenuItem>Mutuals</DropdownMenuItem>
        <DropdownMenuItem>Not following back</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Activity</DropdownMenuLabel>
        <DropdownMenuItem>Recently unfollowed</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
