import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuyMeCoffeeWidget } from '@/components/BuyMeCoffeeWidget';

const BMC_STORAGE_KEY = 'bmc_widget_shown_v1';
const BMC_SCRIPT_ID = 'bmc-script';
const BMC_WIDGET_ID = 'bmc-wbtn';

describe('BuyMeCoffeeWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    // Clean up DOM before each test
    document.getElementById(BMC_SCRIPT_ID)?.remove();
    document.getElementById(BMC_WIDGET_ID)?.remove();
    document.querySelectorAll('iframe[title*="BMC"]').forEach(iframe => iframe.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    localStorage.clear();

    // Clean up DOM after each test
    document.getElementById(BMC_SCRIPT_ID)?.remove();
    document.getElementById(BMC_WIDGET_ID)?.remove();
    document.querySelectorAll('iframe[title*="BMC"]').forEach(iframe => iframe.remove());
  });

  describe('Basic Rendering', () => {
    it('should render without errors', () => {
      const { container } = render(<BuyMeCoffeeWidget show={false} />);
      expect(container).toBeInTheDocument();
    });

    it('should not render any visible content (returns null)', () => {
      const { container } = render(<BuyMeCoffeeWidget show={true} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Script Loading', () => {
    it('should not load script when show=false', () => {
      render(<BuyMeCoffeeWidget show={false} />);

      const script = document.getElementById(BMC_SCRIPT_ID);
      expect(script).not.toBeInTheDocument();
    });

    it('should load script when show=true', () => {
      render(<BuyMeCoffeeWidget show={true} />);

      const script = document.getElementById(BMC_SCRIPT_ID) as HTMLScriptElement;
      expect(script).toBeInTheDocument();
      expect(script.src).toBe('https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js');
      expect(script.async).toBe(true);
    });

    it('should set correct script attributes', () => {
      render(<BuyMeCoffeeWidget show={true} />);

      const script = document.getElementById(BMC_SCRIPT_ID) as HTMLScriptElement;
      expect(script.getAttribute('data-name')).toBe('BMC-Widget');
      expect(script.getAttribute('data-id')).toBe('ignromanov');
      expect(script.getAttribute('data-description')).toBe('Support privacy-first tools');
      expect(script.getAttribute('data-message')).toBe('Thanks for using a private tool! 🛡️');
      expect(script.getAttribute('data-color')).toBe('#6366F1');
      expect(script.getAttribute('data-position')).toBe('left');
      expect(script.getAttribute('data-x_margin')).toBe('18');
      expect(script.getAttribute('data-y_margin')).toBe('18');
    });

    it('should not load script twice if already present', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} />);

      const firstScript = document.getElementById(BMC_SCRIPT_ID);
      expect(firstScript).toBeInTheDocument();

      rerender(<BuyMeCoffeeWidget show={true} />);

      const scripts = document.querySelectorAll(`#${BMC_SCRIPT_ID}`);
      expect(scripts).toHaveLength(1);
    });

    it('should dispatch DOMContentLoaded event on document when script loads', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      render(<BuyMeCoffeeWidget show={true} />);

      const script = document.getElementById(BMC_SCRIPT_ID) as HTMLScriptElement;

      // Simulate script load
      if (script.onload) {
        (script.onload as (this: GlobalEventHandlers, ev: Event) => any).call(
          script,
          new Event('load')
        );
      }

      expect(dispatchSpy).toHaveBeenCalled();
      const dcl = dispatchSpy.mock.calls.find(
        call => call[0] instanceof Event && (call[0] as Event).type === 'DOMContentLoaded'
      );
      expect(dcl).toBeDefined();
    });
  });

  describe('Widget Auto-Expansion', () => {
    it('should not auto-expand if localStorage flag is set', () => {
      localStorage.setItem(BMC_STORAGE_KEY, 'true');

      render(<BuyMeCoffeeWidget show={true} expandDelay={100} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(clickSpy).not.toHaveBeenCalled();

      mockWidget.remove();
    });

    it('should auto-expand after delay if not shown before', async () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(BMC_STORAGE_KEY)).toBe('true');

      mockWidget.remove();
    });

    it('should skip localStorage check when skipStorageCheck=true', () => {
      localStorage.setItem(BMC_STORAGE_KEY, 'true');

      render(
        <BuyMeCoffeeWidget
          show={true}
          expandDelay={100}
          skipStorageCheck={true}
          autoCollapseAfter={0}
        />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });

    it('should not save to localStorage when skipStorageCheck=true', () => {
      render(
        <BuyMeCoffeeWidget
          show={true}
          expandDelay={100}
          skipStorageCheck={true}
          autoCollapseAfter={0}
        />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(localStorage.getItem(BMC_STORAGE_KEY)).toBeNull();

      mockWidget.remove();
    });

    it('should not re-expand in same session', () => {
      const { rerender } = render(
        <BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // First expansion
      vi.advanceTimersByTime(150);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Rerender with show=false then show=true
      rerender(<BuyMeCoffeeWidget show={false} expandDelay={100} autoCollapseAfter={0} />);
      vi.advanceTimersByTime(10);

      rerender(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);
      vi.advanceTimersByTime(150);

      // Should not expand again
      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });

    it('should expand widget if present when timer fires', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });

    it('should handle widget without button element', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Create mock widget without button
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const clickSpy = vi.fn();
      mockWidget.addEventListener('click', clickSpy);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });
  });

  describe('Auto-Collapse', () => {
    it('should auto-collapse after specified time', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={200} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Expand
      vi.advanceTimersByTime(150);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Collapse
      vi.advanceTimersByTime(250);
      expect(clickSpy).toHaveBeenCalledTimes(2);

      mockWidget.remove();
    });

    it('should not auto-collapse when autoCollapseAfter=0', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Expand
      vi.advanceTimersByTime(150);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Wait for potential collapse
      vi.advanceTimersByTime(5000);
      expect(clickSpy).toHaveBeenCalledTimes(1); // Still only 1 click

      mockWidget.remove();
    });
  });

  describe('Cleanup', () => {
    it('should remove script when show changes to false', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} />);

      const script = document.getElementById(BMC_SCRIPT_ID);
      expect(script).toBeInTheDocument();

      rerender(<BuyMeCoffeeWidget show={false} />);

      const removedScript = document.getElementById(BMC_SCRIPT_ID);
      expect(removedScript).not.toBeInTheDocument();
    });

    it('should remove widget element when show changes to false', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      document.body.appendChild(mockWidget);

      expect(document.getElementById(BMC_WIDGET_ID)).toBeInTheDocument();

      rerender(<BuyMeCoffeeWidget show={false} />);

      expect(document.getElementById(BMC_WIDGET_ID)).not.toBeInTheDocument();
    });

    it('should remove BMC iframes on cleanup', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} />);

      // Create mock iframe
      const mockIframe = document.createElement('iframe');
      mockIframe.title = 'BMC Widget';
      document.body.appendChild(mockIframe);

      expect(document.querySelectorAll('iframe[title*="BMC"]')).toHaveLength(1);

      rerender(<BuyMeCoffeeWidget show={false} />);

      expect(document.querySelectorAll('iframe[title*="BMC"]')).toHaveLength(0);
    });

    it('should clear timers on unmount', () => {
      const { unmount } = render(
        <BuyMeCoffeeWidget show={true} expandDelay={1000} autoCollapseAfter={1000} />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      unmount();

      // Advance timers - should not trigger clicks
      vi.advanceTimersByTime(3000);

      expect(clickSpy).not.toHaveBeenCalled();

      mockWidget.remove();
    });

    it('should clear expand timer when show changes to false before timer fires', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} expandDelay={1000} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Change to show=false before timer fires
      vi.advanceTimersByTime(500);
      rerender(<BuyMeCoffeeWidget show={false} expandDelay={1000} />);

      // Complete the original timer duration
      vi.advanceTimersByTime(600);

      expect(clickSpy).not.toHaveBeenCalled();

      mockWidget.remove();
    });

    it('should clear collapse timer on unmount', () => {
      const { unmount } = render(
        <BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={1000} />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Trigger expand
      vi.advanceTimersByTime(150);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Unmount before collapse
      unmount();

      // Advance past collapse time
      vi.advanceTimersByTime(2000);

      // Should still only have 1 click (expand)
      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });
  });

  describe('Props Changes', () => {
    it('should respect custom expandDelay', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={5000} autoCollapseAfter={0} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Should not expand yet
      vi.advanceTimersByTime(3000);
      expect(clickSpy).not.toHaveBeenCalled();

      // Should expand now
      vi.advanceTimersByTime(3000);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockWidget.remove();
    });

    it('should respect custom autoCollapseAfter', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={5000} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Expand
      vi.advanceTimersByTime(150);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Should not collapse yet
      vi.advanceTimersByTime(3000);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Should collapse now
      vi.advanceTimersByTime(3000);
      expect(clickSpy).toHaveBeenCalledTimes(2);

      mockWidget.remove();
    });

    it('should use default props when not provided', () => {
      render(<BuyMeCoffeeWidget show={true} />);

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton.addEventListener('click', clickSpy);
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      // Default expandDelay is 30000ms
      vi.advanceTimersByTime(29000);
      expect(clickSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Default autoCollapseAfter is 10000ms
      // After expand (1 click), wait for collapse
      vi.advanceTimersByTime(11000);
      expect(clickSpy).toHaveBeenCalledTimes(2);

      mockWidget.remove();
    });
  });

  describe('Edge Cases', () => {
    it('should handle widget not present when expand timer fires', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Don't create widget - timer fires without widget present
      expect(() => {
        vi.advanceTimersByTime(150);
      }).not.toThrow();

      expect(localStorage.getItem(BMC_STORAGE_KEY)).toBe('true');
    });

    it('should handle widget not present when collapse timer fires', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={200} />);

      // Create widget for expand
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      // Remove widget before collapse
      mockWidget.remove();

      expect(() => {
        vi.advanceTimersByTime(250);
      }).not.toThrow();
    });

    it('should handle multiple rapid show/hide toggles', () => {
      const { rerender } = render(<BuyMeCoffeeWidget show={true} expandDelay={100} />);

      rerender(<BuyMeCoffeeWidget show={false} expandDelay={100} />);
      rerender(<BuyMeCoffeeWidget show={true} expandDelay={100} />);
      rerender(<BuyMeCoffeeWidget show={false} expandDelay={100} />);
      rerender(<BuyMeCoffeeWidget show={true} expandDelay={100} />);

      const script = document.getElementById(BMC_SCRIPT_ID);
      expect(script).toBeInTheDocument();

      vi.advanceTimersByTime(1000);

      // Should handle without errors
      expect(document.getElementById(BMC_SCRIPT_ID)).toBeInTheDocument();
    });

    it('should handle button element that is not HTMLElement', () => {
      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      // Create widget with text node instead of button
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      mockWidget.appendChild(document.createTextNode('Not a button'));
      document.body.appendChild(mockWidget);

      expect(() => {
        vi.advanceTimersByTime(150);
      }).not.toThrow();

      mockWidget.remove();
    });
  });

  describe('LocalStorage Integration', () => {
    it('should persist widget shown state across renders', () => {
      const { unmount } = render(
        <BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />
      );

      // Create mock widget
      const mockWidget = document.createElement('div');
      mockWidget.id = BMC_WIDGET_ID;
      const mockButton = document.createElement('button');
      mockWidget.appendChild(mockButton);
      document.body.appendChild(mockWidget);

      vi.advanceTimersByTime(150);

      expect(localStorage.getItem(BMC_STORAGE_KEY)).toBe('true');

      unmount();
      mockWidget.remove();

      // New render should not expand
      const mockWidget2 = document.createElement('div');
      mockWidget2.id = BMC_WIDGET_ID;
      const mockButton2 = document.createElement('button');
      const clickSpy = vi.fn();
      mockButton2.addEventListener('click', clickSpy);
      mockWidget2.appendChild(mockButton2);
      document.body.appendChild(mockWidget2);

      render(<BuyMeCoffeeWidget show={true} expandDelay={100} autoCollapseAfter={0} />);

      vi.advanceTimersByTime(150);

      expect(clickSpy).not.toHaveBeenCalled();

      mockWidget2.remove();
    });

    it('should handle localStorage being unavailable gracefully', () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('localStorage unavailable');
      });

      // Component should NOT throw - it catches localStorage errors internally
      expect(() => {
        render(<BuyMeCoffeeWidget show={true} />);
      }).not.toThrow();

      // Restore original
      Storage.prototype.getItem = originalGetItem;
    });
  });
});
