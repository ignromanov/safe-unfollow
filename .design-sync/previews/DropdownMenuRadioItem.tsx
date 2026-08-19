import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function Selected() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Export format</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value="csv" onValueChange={() => {}}>
          <DropdownMenuRadioItem value="csv">CSV</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="json">JSON</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Unselected() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Sort by</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value="" onValueChange={() => {}}>
          <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="az">A&ndash;Z</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
