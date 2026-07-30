import { Blob as NodeBlob } from 'node:buffer';
import { vi } from 'vitest';

/**
 * Setup browser API mocks for jsdom environment
 * Includes: matchMedia, ResizeObserver, IntersectionObserver, scrollTo, attachEvent, Blob
 */
export function setupBrowserMocks() {
  // jsdom's own Blob only implements slice/size/type — no text()/arrayBuffer(),
  // which breaks any test reading back a Blob body (e.g. sendBeacon payloads).
  // Node's Blob is spec-compatible and fully featured, so swap it in globally.
  global.Blob = NodeBlob as unknown as typeof Blob;
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  window.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock window.scrollTo
  Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
    writable: true,
  });

  // Fix for setimmediate package in test environment
  if (typeof global.attachEvent === 'undefined') {
    global.attachEvent = () => {};
  }
}
