import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function Default() {
  return (
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
  );
}

export function WithDisabled() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Export account</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Open profile</DropdownMenuItem>
        <DropdownMenuItem disabled>Copy username</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive">Dismiss</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
