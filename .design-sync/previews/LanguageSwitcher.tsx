import { LanguageSwitcher } from 'safe-unfollow';

// LanguageSwitcher has no props and no way to force its Radix DropdownMenu
// open from outside — it does not forward `open`/`defaultOpen` the way
// DropdownMenu itself does. The closed trigger ("EN" + chevron) is therefore
// the real, only capturable state; the option list belongs to
// DropdownMenuContent/DropdownMenuItem's own previews.
export function Default() {
  return (
    <div className="p-4">
      <LanguageSwitcher />
    </div>
  );
}

// Real context: sits in Header's toolbar, right of a divider, on the card
// background rather than the page background.
export function InHeaderContext() {
  return (
    <div className="flex items-center justify-end gap-2 rounded-xl border border-border bg-card p-3">
      <div className="w-px h-8 bg-border" />
      <LanguageSwitcher />
    </div>
  );
}
