Confirmation dialog for destructive actions (Radix Alert Dialog), from `src/components/ui/alert-dialog.tsx`; the header's "Delete Data" uses it.

The consumer provides a trigger, a title, a description that states the consequence, and a cancel and an action label. Unlike `Dialog`, it cannot be dismissed by clicking the scrim, and focus starts on Cancel. Content is `background`, 24px corners, 32px padding, 24px gaps, an extra-large shadow, at most 448px wide. Header is centred; an optional 64px round icon tile sits above the title (rose tint for delete). Title is 20px bold; description is `muted-foreground` at 16px. Footer centres the actions; stack them on phones. Action buttons are `rounded-2xl`, 12px by 24px, bold; for a delete the action is rose-500 with white text (about 3.3:1, kept from the source), so make it a bold 14px or larger label.

Write the title as a question and the description as what will be lost: "This action cannot be undone." Cancel is always the safer, first option.

Static rendition: no focus trap or animation.
