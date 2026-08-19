import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

export function AsChildButton() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Sort by</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Most recent</DropdownMenuItem>
        <DropdownMenuItem>A&ndash;Z</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PlainTrigger() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-foreground">
        EN
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>English</DropdownMenuItem>
        <DropdownMenuItem>Русский</DropdownMenuItem>
        <DropdownMenuItem>Türkçe</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
