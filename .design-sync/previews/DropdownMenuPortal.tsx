import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Button,
} from 'safe-unfollow';

// DropdownMenuContent already wraps itself in a Portal internally (see
// src/components/ui/dropdown-menu.tsx), so DropdownMenuPortal's real job in
// this API is portaling DropdownMenuSubContent, which does NOT self-portal —
// without it, submenu content stays in-flow under the trigger it grew from.
export function SubmenuPortal() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem>Copy link</DropdownMenuItem>
        <DropdownMenuSub open>
          <DropdownMenuSubTrigger>Download as</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent forceMount>
              <DropdownMenuItem>CSV</DropdownMenuItem>
              <DropdownMenuItem>JSON</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
