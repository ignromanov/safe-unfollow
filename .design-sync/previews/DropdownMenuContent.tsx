import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function AlignStart() {
  return (
    <div className="flex w-full max-w-md justify-start">
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Filter badges</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Badges</DropdownMenuLabel>
          <DropdownMenuItem>Mutuals</DropdownMenuItem>
          <DropdownMenuItem>Recently unfollowed</DropdownMenuItem>
          <DropdownMenuItem>Not following back</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AlignEnd() {
  return (
    <div className="flex w-full max-w-md justify-end">
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Account actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Open profile</DropdownMenuItem>
          <DropdownMenuItem>Copy username</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Dismiss</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
