import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { contrastRatio, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

// Mock Radix UI Slot
vi.mock('@radix-ui/react-slot', () => ({
  Slot: ({ children, ...props }: any) => (
    <div data-testid="slot" {...props}>
      {children}
    </div>
  ),
}));

describe('Badge Component', () => {
  it('should render badge with default variant', () => {
    render(<Badge>Default Badge</Badge>);

    const badge = screen.getByText('Default Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge.tagName).toBe('SPAN');
  });

  it('should render badge with default variant classes', () => {
    render(<Badge>Default Badge</Badge>);

    const badge = screen.getByText('Default Badge');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'rounded-md',
      'border',
      'px-2',
      'py-0.5',
      'text-xs',
      'font-medium',
      'w-fit',
      'whitespace-nowrap',
      'shrink-0',
      '[&>svg]:size-3',
      'gap-1',
      '[&>svg]:pointer-events-none',
      'focus-visible:border-ring',
      'focus-visible:ring-ring/50',
      'focus-visible:ring-[3px]',
      'aria-invalid:ring-destructive/20',
      'dark:aria-invalid:ring-destructive/40',
      'aria-invalid:border-destructive',
      'transition-[color,box-shadow]',
      'overflow-hidden',
      'border-transparent',
      'bg-primary',
      'text-primary-foreground',
      '[a&]:hover:bg-primary/90'
    );
  });

  it('should render badge with secondary variant', () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>);

    const badge = screen.getByText('Secondary Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(
      'border-transparent',
      'bg-secondary',
      'text-secondary-foreground',
      '[a&]:hover:bg-secondary/90'
    );
  });

  it('should render badge with destructive variant', () => {
    render(<Badge variant="destructive">Destructive Badge</Badge>);

    const badge = screen.getByText('Destructive Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(
      'border-transparent',
      'bg-destructive',
      'text-white',
      '[a&]:hover:bg-destructive/90',
      'focus-visible:ring-destructive/20',
      'dark:focus-visible:ring-destructive/40',
      'dark:bg-destructive/60'
    );
  });

  it('should render badge with outline variant', () => {
    render(<Badge variant="outline">Outline Badge</Badge>);

    const badge = screen.getByText('Outline Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(
      'text-foreground',
      '[a&]:hover:bg-accent',
      '[a&]:hover:text-accent-foreground'
    );
  });

  it('should apply custom className', () => {
    render(<Badge className="custom-class">Custom Badge</Badge>);

    const badge = screen.getByText('Custom Badge');
    expect(badge).toHaveClass('custom-class');
  });

  it('should render as child component when asChild is true', () => {
    render(
      <Badge asChild>
        <button>Button Badge</button>
      </Badge>
    );

    const slot = screen.getByTestId('slot');
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveAttribute('data-slot', 'badge');

    const button = screen.getByText('Button Badge');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should render as span when asChild is false', () => {
    render(<Badge asChild={false}>Span Badge</Badge>);

    const badge = screen.getByText('Span Badge');
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('SPAN');
  });

  it('should pass through additional props', () => {
    render(
      <Badge data-testid="test-badge" id="badge-1">
        Test Badge
      </Badge>
    );

    const badge = screen.getByTestId('test-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('id', 'badge-1');
  });

  it('should handle empty content', () => {
    const { container } = render(<Badge></Badge>);

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge).toBeEmptyDOMElement();
  });

  it('should handle complex content', () => {
    const { container } = render(
      <Badge>
        <span>Icon</span>
        <span>Text</span>
      </Badge>
    );

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('IconText');
  });

  it('should handle all variant combinations', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

    variants.forEach(variant => {
      const { unmount } = render(<Badge variant={variant}>{variant} Badge</Badge>);

      const badge = screen.getByText(`${variant} Badge`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-slot', 'badge');

      unmount();
    });
  });

  it('should handle focus and accessibility attributes', () => {
    render(
      <Badge tabIndex={0} role="button">
        Accessible Badge
      </Badge>
    );

    const badge = screen.getByText('Accessible Badge');
    expect(badge).toHaveAttribute('tabIndex', '0');
    expect(badge).toHaveAttribute('role', 'button');
  });

  it('should handle aria-invalid state', () => {
    render(<Badge aria-invalid="true">Invalid Badge</Badge>);

    const badge = screen.getByText('Invalid Badge');
    expect(badge).toHaveAttribute('aria-invalid', 'true');
    expect(badge).toHaveClass(
      'aria-invalid:ring-destructive/20',
      'aria-invalid:border-destructive'
    );
  });

  it('should handle dark mode classes', () => {
    render(<Badge variant="destructive">Dark Badge</Badge>);

    const badge = screen.getByText('Dark Badge');
    expect(badge).toHaveClass(
      'dark:focus-visible:ring-destructive/40',
      'dark:bg-destructive/60',
      'dark:aria-invalid:ring-destructive/40'
    );
  });
});

describe('badgeVariants function', () => {
  it('should return correct classes for default variant', () => {
    const classes = badgeVariants({ variant: 'default' });
    expect(classes).toContain('border-transparent');
    expect(classes).toContain('bg-primary');
    expect(classes).toContain('text-primary-foreground');
  });

  it('should return correct classes for secondary variant', () => {
    const classes = badgeVariants({ variant: 'secondary' });
    expect(classes).toContain('border-transparent');
    expect(classes).toContain('bg-secondary');
    expect(classes).toContain('text-secondary-foreground');
  });

  it('should return correct classes for destructive variant', () => {
    const classes = badgeVariants({ variant: 'destructive' });
    expect(classes).toContain('border-transparent');
    expect(classes).toContain('bg-destructive');
    expect(classes).toContain('text-white');
  });

  it('should return correct classes for outline variant', () => {
    const classes = badgeVariants({ variant: 'outline' });
    expect(classes).toContain('text-foreground');
    expect(classes).toContain('[a&]:hover:bg-accent');
    expect(classes).toContain('[a&]:hover:text-accent-foreground');
  });

  it('should return default variant when no variant specified', () => {
    const classes = badgeVariants();
    expect(classes).toContain('border-transparent');
    expect(classes).toContain('bg-primary');
    expect(classes).toContain('text-primary-foreground');
  });

  it('should include base classes for all variants', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

    variants.forEach(variant => {
      const classes = badgeVariants({ variant });
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('items-center');
      expect(classes).toContain('justify-center');
      expect(classes).toContain('rounded-md');
      expect(classes).toContain('border');
      expect(classes).toContain('px-2');
      expect(classes).toContain('py-0.5');
      expect(classes).toContain('text-xs');
      expect(classes).toContain('font-medium');
    });
  });

  /**
   * The outline badge hovers to a *flat* `--accent` in both themes — it has no
   * `dark:` override, unlike the ghost button. So unlike ghost, the corrected
   * `--accent-foreground` token is the right answer here and no class change was
   * needed; light went from 3.50:1 to 5.63:1 on the token flip alone. This
   * asserts that outcome instead of assuming it.
   */
  describe('outline hover contrast', () => {
    const hoverToken = () => {
      const classes = badgeVariants({ variant: 'outline' });
      const match = classes.match(/hover:text-([a-z-]+)/);
      if (!match) throw new Error(`no hover:text-* in badge outline variant: ${classes}`);
      return `--${match[1]}`;
    };

    it('hovers to a flat accent fill, with no dark-mode surface override', () => {
      // If a `dark:hover:bg-accent/NN` ever appears here, the surface stops
      // being flat accent and this token stops being the correct one — the
      // exact trap the ghost button fell into.
      const classes = badgeVariants({ variant: 'outline' });
      expect(classes).toContain('[a&]:hover:bg-accent');
      expect(classes).not.toMatch(/dark:[a-z[\]&:]*hover:bg-accent\//);
    });

    for (const theme of ['light', 'dark'] as const) {
      it(`${theme}: hover label clears AA on --accent`, () => {
        const ratio = contrastRatio(token(theme, hoverToken()), token(theme, '--accent'));
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });
});
