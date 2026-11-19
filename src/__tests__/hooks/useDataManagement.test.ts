import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { useDataManagement } from '@/hooks/useDataManagement';

// Mock the store
const mockClearData = vi.fn();
const mockSetUploadInfo = vi.fn();

vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(selector => {
    const state = {
      clearData: mockClearData,
      setUploadInfo: mockSetUploadInfo,
    };
    return selector(state);
  }),
}));

describe('useDataManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return handleClearData function', () => {
    const { result } = renderHook(() => useDataManagement());

    expect(result.current.handleClearData).toBeDefined();
    expect(typeof result.current.handleClearData).toBe('function');
  });

  it('should call clearData when handleClearData is called', () => {
    const { result } = renderHook(() => useDataManagement());

    act(() => {
      result.current.handleClearData();
    });

    expect(mockClearData).toHaveBeenCalledTimes(1);
  });

  it('should call setUploadInfo with reset values when handleClearData is called', () => {
    const { result } = renderHook(() => useDataManagement());

    act(() => {
      result.current.handleClearData();
    });

    expect(mockSetUploadInfo).toHaveBeenCalledTimes(1);
    expect(mockSetUploadInfo).toHaveBeenCalledWith({
      currentFileName: null,
      uploadStatus: 'idle',
      uploadError: null,
      fileSize: undefined,
      uploadDate: undefined,
    });
  });

  it('should call both clearData and setUploadInfo in sequence', () => {
    const { result } = renderHook(() => useDataManagement());

    act(() => {
      result.current.handleClearData();
    });

    expect(mockClearData).toHaveBeenCalledTimes(1);
    expect(mockSetUploadInfo).toHaveBeenCalledTimes(1);
  });

  it('should maintain stable reference to handleClearData', () => {
    const { result, rerender } = renderHook(() => useDataManagement());

    const firstReference = result.current.handleClearData;

    rerender();

    const secondReference = result.current.handleClearData;

    expect(firstReference).toBe(secondReference);
  });

  it('should handle multiple calls to handleClearData', () => {
    const { result } = renderHook(() => useDataManagement());

    act(() => {
      result.current.handleClearData();
      result.current.handleClearData();
      result.current.handleClearData();
    });

    expect(mockClearData).toHaveBeenCalledTimes(3);
    expect(mockSetUploadInfo).toHaveBeenCalledTimes(3);
  });

  it('should work with different store implementations', () => {
    // Test that the hook works regardless of store implementation
    const { result } = renderHook(() => useDataManagement());

    expect(result.current).toEqual({
      handleClearData: expect.any(Function),
    });
  });

  it('removes legacy analytics_last_upload key while preserving umami-opt-out', async () => {
    localStorage.setItem('analytics_last_upload', JSON.stringify({ hash: 'old', timestamp: 1 }));
    localStorage.setItem('umami-opt-out', 'true');

    const { result } = renderHook(() => useDataManagement());

    await act(async () => {
      await result.current.handleClearData();
    });

    expect(localStorage.getItem('analytics_last_upload')).toBeNull();
    expect(localStorage.getItem('umami-opt-out')).toBe('true');

    localStorage.removeItem('umami-opt-out');
  });
});
