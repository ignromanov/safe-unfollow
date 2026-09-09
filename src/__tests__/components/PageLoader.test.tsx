import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '@/components/PageLoader';

describe('PageLoader', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<PageLoader />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render loading text', () => {
      render(<PageLoader />);

      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('should render spinner icon', () => {
      const { container } = render(<PageLoader />);

      // Lucide Loader2 renders as svg
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have animate-spin class on spinner', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });

    it('should have correct spinner size classes', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-8', 'w-8');
    });

    it('should have primary color on spinner', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      // `text-primary-strong`, not `text-primary`: the brand colour split into
      // a fill token and a foreground token in GH#210, because one lightness
      // cannot clear AA in both roles. Contrast is measured in
      // a11y/primary-text-contrast.test.ts; this only pins which token paints.
      expect(svg).toHaveClass('text-primary-strong');
    });

    it('should center spinner with margin', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('mx-auto', 'mb-4');
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden on spinner icon', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have visible loading text for screen readers', () => {
      render(<PageLoader />);

      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toBeVisible();
    });

    it('should not have role=status or aria-live (relies on text visibility)', () => {
      const { container } = render(<PageLoader />);

      // PageLoader uses visible text instead of aria-live
      const statusElements = container.querySelectorAll('[role="status"]');
      expect(statusElements.length).toBe(0);
    });
  });

  describe('layout', () => {
    it('should render in a centered container', () => {
      const { container } = render(<PageLoader />);

      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('flex', 'flex-1', 'items-center', 'justify-center', 'py-20');
    });

    it('should have text-center on inner wrapper', () => {
      const { container } = render(<PageLoader />);

      const textWrapper = screen.getByText('Loading...').parentElement;
      expect(textWrapper).toHaveClass('text-center');
    });

    it('should render spinner above text', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');
      const text = screen.getByText('Loading...');

      // Check DOM order: svg should come before text
      const textWrapper = text.parentElement;
      const children = Array.from(textWrapper!.children);
      const svgIndex = children.indexOf(svg!);
      const textIndex = children.indexOf(text);

      expect(svgIndex).toBeLessThan(textIndex);
    });
  });

  describe('styling', () => {
    it('should have proper vertical padding on container', () => {
      const { container } = render(<PageLoader />);

      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('py-20');
    });

    it('should have muted foreground color on text', () => {
      render(<PageLoader />);

      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toHaveClass('text-muted-foreground');
    });

    it('should have small text size', () => {
      render(<PageLoader />);

      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toHaveClass('text-sm');
    });

    it('should apply flex-1 for full height', () => {
      const { container } = render(<PageLoader />);

      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('flex-1');
    });
  });

  describe('use cases', () => {
    it('should work as Suspense fallback', () => {
      // PageLoader is designed for Suspense fallback
      // It should render without any props
      const { container } = render(<PageLoader />);

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render multiple instances independently', () => {
      const { container } = render(
        <>
          <PageLoader />
          <PageLoader />
        </>
      );

      const loadingTexts = screen.getAllByText('Loading...');
      expect(loadingTexts).toHaveLength(2);

      const spinners = container.querySelectorAll('svg');
      expect(spinners).toHaveLength(2);
    });

    it('should not accept any props', () => {
      // PageLoader doesn't accept props - it's a static component
      // This test ensures the component signature is correct
      const { container } = render(<PageLoader />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('visual appearance', () => {
    it('should render with all expected CSS classes', () => {
      const { container } = render(<PageLoader />);

      const outerDiv = container.firstChild as HTMLElement;
      const innerDiv = outerDiv.firstChild as HTMLElement;
      const svg = container.querySelector('svg');
      const text = screen.getByText('Loading...');

      // Outer container
      expect(outerDiv.className).toContain('flex');
      expect(outerDiv.className).toContain('flex-1');
      expect(outerDiv.className).toContain('items-center');
      expect(outerDiv.className).toContain('justify-center');
      expect(outerDiv.className).toContain('py-20');

      // Inner text wrapper
      expect(innerDiv.className).toContain('text-center');

      // Spinner
      expect(svg?.className.baseVal).toContain('animate-spin');
      // `toHaveClass`, not `toContain`: as a substring check this line stayed
      // green through the GH#210 rename that turned the assertion above red,
      // and it would pass on `text-primary-foreground` too. A class assertion
      // that matches its own prefix is not asserting the class.
      expect(svg).toHaveClass('text-primary-strong');

      // Text
      expect(text.className).toContain('text-sm');
      expect(text.className).toContain('text-muted-foreground');
    });

    it('should maintain consistent spacing', () => {
      const { container } = render(<PageLoader />);

      const svg = container.querySelector('svg');

      // Spinner should have bottom margin for spacing above text
      expect(svg).toHaveClass('mb-4');
    });
  });

  describe('edge cases', () => {
    it('should handle rapid mounting and unmounting', () => {
      const { unmount, container } = render(<PageLoader />);
      expect(container.firstChild).toBeInTheDocument();

      unmount();
      expect(container.firstChild).not.toBeInTheDocument();

      // Re-render
      const { container: container2 } = render(<PageLoader />);
      expect(container2.firstChild).toBeInTheDocument();
    });

    it('should not cause console errors when rendered', () => {
      // This test ensures no React warnings/errors
      const consoleError = vi.spyOn(console, 'error');

      render(<PageLoader />);

      expect(consoleError).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should render correctly in different container sizes', () => {
      // Test that flex-1 and centering work properly
      const { container } = render(
        <div style={{ height: '500px' }}>
          <PageLoader />
        </div>
      );

      const loader = container.querySelector('.flex.flex-1');
      expect(loader).toHaveClass('items-center', 'justify-center');
    });
  });

  describe('component structure', () => {
    it('should have correct DOM hierarchy', () => {
      const { container } = render(<PageLoader />);

      // Structure: div > div > (svg + p)
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.tagName).toBe('DIV');

      const innerDiv = outerDiv.firstChild as HTMLElement;
      expect(innerDiv.tagName).toBe('DIV');

      const svg = innerDiv.querySelector('svg');
      const text = innerDiv.querySelector('p');

      expect(svg).toBeInTheDocument();
      expect(text).toBeInTheDocument();
      expect(text?.textContent).toBe('Loading...');
    });

    it('should render text in paragraph tag', () => {
      render(<PageLoader />);

      const text = screen.getByText('Loading...');
      expect(text.tagName).toBe('P');
    });

    it('should have exactly two div elements', () => {
      const { container } = render(<PageLoader />);

      const divs = container.querySelectorAll('div');
      expect(divs.length).toBe(2);
    });
  });
});
