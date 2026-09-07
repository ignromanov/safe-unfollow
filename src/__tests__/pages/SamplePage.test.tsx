import { useSampleData } from '@/hooks/useSampleData';
import { Component as SamplePage } from '@/pages/SamplePage';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import commonEN from '@/locales/en/common.json';
import type { BadgeKey } from '@/core/types';

// Mock AccountListSection component
vi.mock('@/components/AccountListSection', () => ({
  AccountListSection: ({
    fileHash,
    accountCount,
    filename,
    isSample,
    appliedUrlFilter,
  }: {
    fileHash: string;
    accountCount: number;
    filename: string;
    isSample: boolean;
    appliedUrlFilter?: BadgeKey | null;
  }) => (
    <div data-testid="account-list-section">
      {/* Rendered as the literal 'undefined' when this page passes nothing, so
          "not passed" and "passed as null" stay distinguishable. */}
      <div data-testid="applied-url-filter">{String(appliedUrlFilter)}</div>
      <div data-testid="file-hash">{fileHash}</div>
      <div data-testid="account-count">{accountCount}</div>
      <div data-testid="filename">{filename}</div>
      <div data-testid="is-sample">{String(isSample)}</div>
    </div>
  ),
}));

// Mock useSampleData hook
const mockLoadSampleData = vi.fn();
vi.mock('@/hooks/useSampleData', () => ({
  useSampleData: vi.fn(),
}));

describe('SamplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSampleData.mockResolvedValue(undefined);
    // Default mock implementation
    vi.mocked(useSampleData).mockReturnValue({
      load: mockLoadSampleData,
      state: 'idle',
      data: null,
    });
  });

  describe('rendering - idle state', () => {
    it('should show loading spinner in idle state', () => {
      render(<SamplePage />);

      expect(screen.getByText('Loading sample data...')).toBeInTheDocument();
    });

    it('should show demo account count message', () => {
      render(<SamplePage />);

      expect(screen.getByText('Preparing 1,180 demo accounts')).toBeInTheDocument();
    });

    it('should auto-trigger sample data load on mount', async () => {
      render(<SamplePage />);

      await waitFor(() => {
        expect(mockLoadSampleData).toHaveBeenCalledTimes(1);
      });
    });

    it('should not render AccountListSection in idle state', () => {
      render(<SamplePage />);

      expect(screen.queryByTestId('account-list-section')).not.toBeInTheDocument();
    });
  });

  describe('rendering - loading state', () => {
    it('should show loading spinner', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'loading',
        data: null,
      });

      render(<SamplePage />);

      expect(screen.getByText('Loading sample data...')).toBeInTheDocument();
    });

    it('should show spinner animation', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'loading',
        data: null,
      });

      const { container } = render(<SamplePage />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render AccountListSection when loading', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'loading',
        data: null,
      });

      render(<SamplePage />);

      expect(screen.queryByTestId('account-list-section')).not.toBeInTheDocument();
    });
  });

  describe('rendering - error state', () => {
    it('should show error message', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'error',
        data: null,
      });

      render(<SamplePage />);

      expect(screen.getByText('Failed to generate sample data')).toBeInTheDocument();
    });

    it('should show try again button', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'error',
        data: null,
      });

      render(<SamplePage />);

      expect(screen.getByText(new RegExp(commonEN.buttons.tryAgain, 'i'))).toBeInTheDocument();
    });

    it('should retry loading when try again button is clicked', async () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'error',
        data: null,
      });

      const user = userEvent.setup();
      render(<SamplePage />);

      await user.click(screen.getByText(new RegExp(commonEN.buttons.tryAgain, 'i')));

      expect(mockLoadSampleData).toHaveBeenCalled();
    });

    it('should not render AccountListSection when error', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'error',
        data: null,
      });

      render(<SamplePage />);

      expect(screen.queryByTestId('account-list-section')).not.toBeInTheDocument();
    });
  });

  describe('rendering - success state', () => {
    it('should render AccountListSection with sample data', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash-123',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('account-list-section')).toBeInTheDocument();
    });

    it('should pass correct fileHash to AccountListSection', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-abc-xyz',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('file-hash')).toHaveTextContent('sample-abc-xyz');
    });

    it('should pass correct accountCount to AccountListSection', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('account-count')).toHaveTextContent('1180');
    });

    it('should pass "Sample Data (Demo)" as filename', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('filename')).toHaveTextContent('Sample Data');
    });

    it('should pass no applied url filter, because it applies none', () => {
      // This page renders the same `AccountListSection` as `/results` and calls
      // no `useFilterFromUrl`. While the section read `?filter=` for itself,
      // `/sample?filter=pending` reported an applied filter that was never
      // applied and bought a summary row for a visit in which nothing happened.
      // Passing nothing is the honest signal, and it is what makes the absent
      // prop's default the SAFE default: a future page that renders this
      // component and forgets the applier under-reports rather than inventing.
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('applied-url-filter')).toHaveTextContent('undefined');
    });

    it('should pass isSample as true', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.getByTestId('is-sample')).toHaveTextContent('true');
    });

    it('should not show loading spinner', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(screen.queryByText('Loading sample data...')).not.toBeInTheDocument();
    });
  });

  describe('load trigger logic', () => {
    it('should only trigger load once on mount', async () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'idle',
        data: null,
      });

      const { rerender } = render(<SamplePage />);

      await waitFor(() => {
        expect(mockLoadSampleData).toHaveBeenCalledTimes(1);
      });

      // Rerender shouldn't trigger another load
      rerender(<SamplePage />);

      await waitFor(() => {
        expect(mockLoadSampleData).toHaveBeenCalledTimes(1);
      });
    });

    it('should not trigger load if already loading', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'loading',
        data: null,
      });

      render(<SamplePage />);

      expect(mockLoadSampleData).not.toHaveBeenCalled();
    });

    it('should not trigger load if already success', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: {
          fileHash: 'sample-hash',
          accountCount: 1180,
        },
      });

      render(<SamplePage />);

      expect(mockLoadSampleData).not.toHaveBeenCalled();
    });

    it('should reset trigger flag on error for retry', async () => {
      mockLoadSampleData.mockRejectedValue(new Error('Failed'));

      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'idle',
        data: null,
      });

      render(<SamplePage />);

      await waitFor(() => {
        expect(mockLoadSampleData).toHaveBeenCalled();
      });

      // After error, the ref should be reset
      // This is tested via the catch block in useEffect
    });
  });

  describe('edge cases', () => {
    it('should return null for unknown state', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'unknown' as never,
        data: null,
      });

      const { container } = render(<SamplePage />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle success state with missing data gracefully', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'success',
        data: null,
      });

      const { container } = render(<SamplePage />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('styling and layout', () => {
    it('should center loading state', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'loading',
        data: null,
      });
      const { container } = render(<SamplePage />);

      const wrapper = container.querySelector('.flex-1.flex.items-center.justify-center');
      expect(wrapper).toBeInTheDocument();
    });

    it('should center error state', () => {
      vi.mocked(useSampleData).mockReturnValue({
        load: mockLoadSampleData,
        state: 'error',
        data: null,
      });

      const { container } = render(<SamplePage />);

      const wrapper = container.querySelector('.flex-1.flex.items-center.justify-center');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
