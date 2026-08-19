import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function FilterBadges() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Filter badges</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>Show only</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked onCheckedChange={() => {}}>
          Mutuals
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked onCheckedChange={() => {}}>
          Recently unfollowed
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onCheckedChange={() => {}}>
          Not following back
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onCheckedChange={() => {}}>Restricted</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AllCleared() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Filter badges</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuCheckboxItem onCheckedChange={() => {}}>Mutuals</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onCheckedChange={() => {}}>
          Not following back
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onCheckedChange={() => {}}>
          Close friends
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
