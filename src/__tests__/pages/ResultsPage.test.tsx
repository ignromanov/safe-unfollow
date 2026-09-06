import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component as ResultsPage } from '@/pages/ResultsPage';
import { useAppStore } from '@/lib/store';
import heroEN from '@/locales/en/hero.json';

import type { BadgeKey, FileMetadata } from '@/core/types';

// Mock child components
vi.mock('@/components/AccountListSection', () => ({
  AccountListSection: ({
    fileHash,
    accountCount,
    filename,
    isSample,
  }: {
    fileHash: string;
    accountCount: number;
    filename: string;
    isSample: boolean;
  }) => (
    <div data-testid="account-list-section">
      <div data-testid="file-hash">{fileHash}</div>
      <div data-testid="account-count">{accountCount}</div>
      <div data-testid="filename">{filename}</div>
      <div data-testid="is-sample">{String(isSample)}</div>
    </div>
  ),
}));

vi.mock('@/components/Hero', () => ({
  Hero: ({ hasData }: { hasData: boolean }) => (
    <div data-testid="hero-fallback">
      <span data-testid="has-data">{String(hasData)}</span>
    </div>
  ),
}));

vi.mock('@/components/DiagnosticErrorScreen', () => ({
  DiagnosticErrorScreen: ({
    errorMessage,
    onTryAgain,
    onOpenWizard,
  }: {
    errorMessage: string;
    onTryAgain: () => void;
    onOpenWizard: () => void;
  }) => (
    <div data-testid="diagnostic-error-screen">
      <div data-testid="error-message">{errorMessage}</div>
      <button onClick={onTryAgain}>Try Again</button>
      <button onClick={onOpenWizard}>{heroEN.buttons.getGuide}</button>
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
// Mutable, and the only location this page sees: `useFilterFromUrl` reads `?filter=` off it
// at hydration.
// ⚠️ This suite gates the WIRING — that the page calls the hook at all — and nothing else.
// It does not exercise the once-per-mount guard: every test here renders once and never
// triggers a second render, so the effect runs once whether or not a guard exists. Removing
// the guard leaves this file 18/18 green, verified by mutation. The guard is gated by
// `src/__tests__/hooks/useFilterFromUrl.test.tsx`.
const mockSearch = { value: '' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch.value), vi.fn()],
}));

// Mock hooks with vi.fn() for dynamic returns
const mockUseLanguagePrefix = vi.fn(() => '');
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => mockUseLanguagePrefix(),
}));

const FILE: FileMetadata = {
  name: 'instagram_export.zip',
  size: 1,
  uploadDate: new Date('2026-01-01'),
  fileHash: 'abc123',
  accountCount: 1500,
};

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLanguagePrefix.mockReturnValue('');
    mockSearch.value = '';
    useAppStore.setState({
      uploadStatus: 'idle',
      uploadError: null,
      fileMetadata: null,
      filters: new Set<BadgeKey>(),
    });
  });

  // Gates the wiring, not the hook — useFilterFromUrl has its own suite. Without these the
  // call could be deleted from the page and every other test here would stay green.
  describe('?filter= on arrival', () => {
    it('should apply the badge named in the URL', () => {
      mockSearch.value = '?filter=pending';
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      render(<ResultsPage />);

      expect([...useAppStore.getState().filters]).toEqual(['pending']);
    });

    it('should replace a persisted selection rather than intersecting it', () => {
      mockSearch.value = '?filter=pending';
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: FILE,
        filters: new Set<BadgeKey>(['unfollowed']),
      });

      render(<ResultsPage />);

      expect([...useAppStore.getState().filters]).toEqual(['pending']);
    });

    it('should leave the selection alone when no parameter is present', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: FILE,
        filters: new Set<BadgeKey>(['unfollowed']),
      });

      render(<ResultsPage />);

      expect([...useAppStore.getState().filters]).toEqual(['unfollowed']);
    });
  });

  describe('rendering with data', () => {
    it('should render AccountListSection when data is available', () => {
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      render(<ResultsPage />);

      expect(screen.getByTestId('account-list-section')).toBeInTheDocument();
      expect(screen.queryByTestId('hero-fallback')).not.toBeInTheDocument();
    });

    it('should pass correct props to AccountListSection', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: { ...FILE, fileHash: 'def456', accountCount: 2500, name: 'my_data.zip' },
      });

      render(<ResultsPage />);

      expect(screen.getByTestId('file-hash')).toHaveTextContent('def456');
      expect(screen.getByTestId('account-count')).toHaveTextContent('2500');
      expect(screen.getByTestId('filename')).toHaveTextContent('my_data.zip');
      expect(screen.getByTestId('is-sample')).toHaveTextContent('false');
    });

    it('should handle large account counts', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: {
          ...FILE,
          fileHash: 'large123',
          accountCount: 1000000,
          name: 'large_export.zip',
        },
      });

      render(<ResultsPage />);

      expect(screen.getByTestId('account-count')).toHaveTextContent('1000000');
    });
  });

  describe('rendering without data (fallback)', () => {
    it('should render Hero fallback when no data is available', () => {
      render(<ResultsPage />);

      expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('account-list-section')).not.toBeInTheDocument();
    });

    it('should render DiagnosticErrorScreen when upload status is error', () => {
      useAppStore.setState({ uploadStatus: 'error', uploadError: 'Failed to parse' });

      render(<ResultsPage />);

      expect(screen.getByTestId('diagnostic-error-screen')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to parse');
      expect(screen.queryByTestId('hero-fallback')).not.toBeInTheDocument();
    });

    it('should render Hero when upload status is loading', () => {
      useAppStore.setState({ uploadStatus: 'loading' });

      render(<ResultsPage />);

      expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
    });

    it('should pass hasData as false to Hero fallback', () => {
      render(<ResultsPage />);

      expect(screen.getByTestId('has-data')).toHaveTextContent('false');
    });
  });

  // The Hero fallback's own CTAs are real anchors now — Hero navigates on its
  // own (covered by Hero.test.tsx) and no longer takes navigation handlers
  // from this page. "language prefix support" for the error-screen path is
  // still covered below, under "navigation - DiagnosticErrorScreen handlers".

  describe('navigation - DiagnosticErrorScreen handlers', () => {
    beforeEach(() => {
      useAppStore.setState({ uploadStatus: 'error', uploadError: 'Upload failed' });
    });

    it('should navigate to upload when Try Again is clicked', async () => {
      const user = userEvent.setup();
      render(<ResultsPage />);

      await user.click(screen.getByText('Try Again'));

      expect(mockNavigate).toHaveBeenCalledWith('/upload');
    });

    it('sends an undiagnosed failure to the guide start, not the format step', async () => {
      // The stub above only proves a click fires a prop — it says nothing about
      // where the real link goes. `/results` only ever supplies `errorMessage`
      // (no errorCode), so the real DiagnosticErrorScreen resolves this to
      // 'UNKNOWN'. Unmock it — and the router it needs for its real <Link> — to
      // check the actual destination.
      vi.doUnmock('@/components/DiagnosticErrorScreen');
      vi.doUnmock('react-router-dom');
      vi.resetModules();

      const { renderWithRouter } = await import('@/__tests__/test-utils');
      const { Component: RealResultsPage } = await import('@/pages/ResultsPage');
      const { useAppStore: freshStore } = await import('@/lib/store');

      freshStore.setState({ uploadStatus: 'error', uploadError: 'Upload failed' });

      renderWithRouter(<RealResultsPage />);

      const wizardLink = screen
        .getAllByRole('link')
        .find(link => link.getAttribute('href')?.includes('/upload?'));

      expect(wizardLink).toBeDefined();
      // Undiagnosed opens the guide from the start rather than claiming a
      // section — ?guide=1, not ?step=1.
      expect(wizardLink!).toHaveAttribute('href', expect.stringMatching(/\/upload\?guide=1$/));

      vi.doUnmock('@/components/DiagnosticErrorScreen');
      vi.doUnmock('react-router-dom');
      vi.resetModules();
    });

    it('should use language prefix in error navigation', async () => {
      mockUseLanguagePrefix.mockReturnValue('/de');

      const user = userEvent.setup();
      render(<ResultsPage />);

      await user.click(screen.getByText('Try Again'));

      expect(mockNavigate).toHaveBeenCalledWith('/de/upload');
    });
  });

  describe('conditional rendering logic', () => {
    it('should show results when fileMetadata exists with fileHash', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: { ...FILE, fileHash: 'valid-hash', accountCount: 100, name: 'test.zip' },
      });

      render(<ResultsPage />);

      expect(screen.getByTestId('account-list-section')).toBeInTheDocument();
    });

    it('should show Hero when fileMetadata is missing fileHash', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: { ...FILE, fileHash: undefined, accountCount: 100, name: 'test.zip' },
      });

      render(<ResultsPage />);

      expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
    });

    it('should show Hero when fileMetadata is missing accountCount', () => {
      useAppStore.setState({
        uploadStatus: 'success',
        fileMetadata: {
          ...FILE,
          fileHash: 'valid-hash',
          accountCount: undefined,
          name: 'test.zip',
        },
      });

      render(<ResultsPage />);

      expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
    });
  });

  describe('SSR/hydration parity', () => {
    it('renders the skeleton on the server even when the store already holds a successful file', () => {
      // `/results` ships prerendered from an empty store (dist/results.html, no rewrite in
      // vercel.json). getServerSnapshot is the only thing standing between a returning
      // visitor and a first render that disagrees with that prerendered HTML.
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      const html = renderToString(<ResultsPage />);

      expect(html).toContain('results-skeleton');
      expect(html).not.toContain('account-list-section');
    });

    it('prerenders a skeleton, not the landing page a returning visitor has already read', () => {
      // GH#44. The prerendered document is what is on screen for the whole JS load window,
      // so whatever this branch emits is what a returning visitor stares at while their own
      // data loads. The Hero belongs to `/`, and stays the post-hydration no-data branch.
      const html = renderToString(<ResultsPage />);

      expect(html).toContain('results-skeleton');
      expect(html).not.toContain('hero-fallback');
    });
  });
});
