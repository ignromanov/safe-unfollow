import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component as ResultsPage } from '@/pages/ResultsPage';
import { useAppStore } from '@/lib/store';
import heroEN from '@/locales/en/hero.json';

import type { FileMetadata } from '@/core/types';

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
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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
    useAppStore.setState({ uploadStatus: 'idle', uploadError: null, fileMetadata: null });
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

    it('should navigate to wizard when Open Wizard is clicked', async () => {
      const user = userEvent.setup();
      render(<ResultsPage />);

      await user.click(screen.getByText(heroEN.buttons.getGuide));

      expect(mockNavigate).toHaveBeenCalledWith('/wizard');
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
    it('renders the no-data branch on the server even when the store already holds a successful file', () => {
      // `/results` ships prerendered from an empty store (dist/results.html, no rewrite in
      // vercel.json). getServerSnapshot is the only thing standing between a returning
      // visitor and a first render that disagrees with that prerendered HTML.
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

      const html = renderToString(<ResultsPage />);

      expect(html).toContain('hero-fallback');
      expect(html).not.toContain('account-list-section');
    });
  });
});
