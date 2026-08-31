import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

// Prefixed translations prove the label goes through i18n rather than being
// hardcoded (the English string would be indistinguishable from a literal).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
    i18n: { language: 'en' },
  }),
}));

// Mock Radix UI Dialog
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="dialog-root" {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, ...props }: any) => (
    <button data-testid="dialog-trigger" {...props}>
      {children}
    </button>
  ),
  Portal: ({ children, ...props }: any) => (
    <div data-testid="dialog-portal" {...props}>
      {children}
    </div>
  ),
  Close: ({ children, ...props }: any) => (
    <button data-testid="dialog-close" {...props}>
      {children}
    </button>
  ),
  Overlay: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-overlay" className={className} {...props}>
      {children}
    </div>
  )),
  Content: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
    <div ref={ref} data-testid="dialog-content" className={className} {...props}>
      {children}
    </div>
  )),
  Header: ({ children, className, ...props }: any) => (
    <div data-testid="dialog-header" className={className} {...props}>
      {children}
    </div>
  ),
  Title: ({ children, className, ...props }: any) => (
    <h2 data-testid="dialog-title" className={className} {...props}>
      {children}
    </h2>
  ),
  Description: ({ children, className, ...props }: any) => (
    <p data-testid="dialog-description" className={className} {...props}>
      {children}
    </p>
  ),
  Footer: ({ children, className, ...props }: any) => (
    <div data-testid="dialog-footer" className={className} {...props}>
      {children}
    </div>
  ),
}));

describe('Dialog Components', () => {
  describe('Dialog', () => {
    it('should render dialog root', () => {
      render(
        <Dialog open={true}>
          <div>Dialog Content</div>
        </Dialog>
      );

      const dialogRoot = screen.getByTestId('dialog-root');
      expect(dialogRoot).toBeInTheDocument();
    });
  });

  describe('DialogTrigger', () => {
    it('should render dialog trigger', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
        </Dialog>
      );

      const trigger = screen.getByTestId('dialog-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Open Dialog');
    });
  });

  describe('DialogContent', () => {
    it('should render dialog content', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <div>Content</div>
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content).toBeInTheDocument();
    });

    // 11 locales, including RTL Arabic — an English-only screen-reader label
    // would be the only untranslated string in the dialog.
    it('should label the built-in close button from translations', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <div>Content</div>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('translated:buttons.close')).toBeInTheDocument();
    });

    // The sticky Header is z-[80] and stayed clickable, with its buttons
    // absent from the accessibility tree, while a tall dialog rendered
    // underneath it. z-[90] clears the header and stays below the dropdown
    // menu's z-[100], so a menu opened from inside a dialog still wins.
    it('renders above the sticky header and below the dropdown menu', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <div>Content</div>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('dialog-overlay')).toHaveClass('z-[90]');
      expect(screen.getByTestId('dialog-content')).toHaveClass('z-[90]');
    });
  });

  describe('DialogTitle', () => {
    it('should render dialog title', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const title = screen.getByTestId('dialog-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Test Title');
    });
  });

  describe('DialogDescription', () => {
    it('should render dialog description', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
              <DialogDescription>Test Description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const description = screen.getByTestId('dialog-description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent('Test Description');
    });
  });

  describe('DialogClose', () => {
    it('should render dialog close button', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      );

      const closeButtons = screen.getAllByTestId('dialog-close');
      expect(closeButtons.length).toBeGreaterThan(0);
      expect(closeButtons[0]).toBeInTheDocument();
      expect(closeButtons[0]).toHaveTextContent('Close');
    });
  });

  describe('Integration', () => {
    it('should render basic dialog structure', () => {
      render(
        <Dialog open={true}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>This is a test dialog</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
    });
  });
});
