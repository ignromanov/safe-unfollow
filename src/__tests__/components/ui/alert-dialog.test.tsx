import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

describe('AlertDialog', () => {
  // Same regression as ui/dialog.tsx: the sticky Header is z-[80] and stayed
  // clickable, with its buttons absent from the accessibility tree, while a
  // tall dialog rendered underneath it. z-[90] clears the header and stays
  // below the dropdown menu's z-[100].
  it('renders above the sticky header and below the dropdown menu', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    );

    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass('z-[90]');
    expect(screen.getByRole('alertdialog')).toHaveClass('z-[90]');
  });
});
