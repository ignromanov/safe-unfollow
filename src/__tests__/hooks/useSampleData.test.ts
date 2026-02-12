/**
 * useSampleData Hook Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSampleData } from '@/hooks/useSampleData';
import * as sampleDataModule from '@/lib/sample-data';

// Mock store actions
const mockSetUploadInfo = vi.fn();
const mockSetFilters = vi.fn();
const mockAdvanceJourney = vi.fn();

// Mock dependencies
vi.mock('@/lib/sample-data', () => ({
  generateAndStoreSampleData: vi.fn(),
  clearSampleData: vi.fn(),
}));

// Mock analytics (V9: fileUploadError removed)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    fileUploadStart: vi.fn(),
    fileUploadSuccess: vi.fn(),
    sampleDataLoad: vi.fn(),
  },
}));

vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(selector => {
    const state = {
      setUploadInfo: mockSetUploadInfo,
      setFilters: mockSetFilters,
      advanceJourney: mockAdvanceJourney,
    };
    return selector(state);
  }),
}));

describe('useSampleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should generate sample data and return result', async () => {
      // Mock successful generation
      vi.mocked(sampleDataModule.generateAndStoreSampleData).mockResolvedValue({
        fileHash: 'sample-demo-data-v1',
        accountCount: 1000,
      });

      const { result } = renderHook(() => useSampleData());

      expect(result.current.state).toBe('idle');

      // Load sample data
      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.load();
      });

      // Should return the result
      expect(loadResult).toEqual({
        fileHash: 'sample-demo-data-v1',
        accountCount: 1000,
      });

      // Should update state
      expect(result.current.state).toBe('success');
      expect(result.current.data).toEqual({
        fileHash: 'sample-demo-data-v1',
        accountCount: 1000,
      });
      expect(result.current.error).toBe(null);
    });

    it('should handle errors during generation', async () => {
      // Mock error
      const error = new Error('Generation failed');
      vi.mocked(sampleDataModule.generateAndStoreSampleData).mockRejectedValue(error);

      const { result } = renderHook(() => useSampleData());

      // Load sample data
      await act(async () => {
        try {
          await result.current.load();
        } catch (err) {
          expect(err).toBe(error);
        }
      });

      // Should update state with error
      expect(result.current.state).toBe('error');
      expect(result.current.error).toBe('Generation failed');
      expect(result.current.data).toBe(null);
    });

    it('should set state during generation', async () => {
      // Mock delayed generation
      let resolveGeneration: (value: any) => void;
      const generationPromise = new Promise(resolve => {
        resolveGeneration = resolve;
      });

      vi.mocked(sampleDataModule.generateAndStoreSampleData).mockReturnValue(
        generationPromise as any
      );

      const { result } = renderHook(() => useSampleData());

      expect(result.current.state).toBe('idle');

      // Start loading
      act(() => {
        result.current.load();
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.state).toBe('loading');
      });

      // Complete generation
      await act(async () => {
        resolveGeneration!({ fileHash: 'sample-demo-data-v1', accountCount: 1000 });
        await generationPromise;
      });

      // Should be success
      await waitFor(() => {
        expect(result.current.state).toBe('success');
      });
    });
  });

  describe('clear', () => {
    it('should clear sample data and reset state', async () => {
      const { result } = renderHook(() => useSampleData());

      // First load data
      vi.mocked(sampleDataModule.generateAndStoreSampleData).mockResolvedValue({
        fileHash: 'sample-demo-data-v1',
        accountCount: 1000,
      });

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.state).toBe('success');
      expect(result.current.data).not.toBe(null);

      // Now clear
      await act(async () => {
        await result.current.clear();
      });

      expect(sampleDataModule.clearSampleData).toHaveBeenCalled();
      expect(result.current.state).toBe('idle');
      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should handle errors silently', async () => {
      // Mock error
      const error = new Error('Clear failed');
      vi.mocked(sampleDataModule.clearSampleData).mockRejectedValue(error);

      const { result } = renderHook(() => useSampleData());

      // Should not throw
      await act(async () => {
        await result.current.clear();
      });

      expect(sampleDataModule.clearSampleData).toHaveBeenCalled();
    });
  });
});
