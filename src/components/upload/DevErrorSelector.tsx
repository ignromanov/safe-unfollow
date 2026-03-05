import type { DiagnosticErrorCode } from '@/core/types';
import { ALL_DIAGNOSTIC_ERROR_CODES } from '@/core/types';
import { useState } from 'react';

interface DevErrorSelectorProps {
  currentCode: DiagnosticErrorCode | null;
  onSelect: (code: DiagnosticErrorCode | null) => void;
  onClose: () => void;
}

/**
 * Dev-only floating panel to switch between error states.
 * Allows testing all error screens with real Try Again / Show Wizard actions.
 */
export function DevErrorSelector({ currentCode, onSelect, onClose }: DevErrorSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 start-4 z-50 max-w-xs">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between px-4 py-3 text-start"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            🔧 Dev: Error Preview
          </span>
          <span className="text-xs text-zinc-500">
            {currentCode ?? 'none'} • {ALL_DIAGNOSTIC_ERROR_CODES.length} types
          </span>
        </button>

        {/* Error list */}
        {isExpanded && (
          <div className="border-t border-zinc-800 p-3">
            <div className="mb-3 grid max-h-[40vh] grid-cols-2 gap-1 overflow-y-auto">
              {ALL_DIAGNOSTIC_ERROR_CODES.map(code => (
                <button
                  key={code}
                  onClick={() => onSelect(code)}
                  className={`rounded px-2 py-1.5 text-start text-xs transition-colors ${
                    currentCode === code
                      ? 'bg-blue-600 font-medium text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {code.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800 pt-3">
              <button
                onClick={onClose}
                className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Clear Preview
              </button>
            </div>

            {/* Hint */}
            <p className="mt-2 text-[10px] text-zinc-500">
              Click error type to preview. Use &quot;Try Again&quot; and &quot;Show Wizard&quot;
              buttons to test actions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
