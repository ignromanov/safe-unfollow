/**
 * Parse Worker Management Hook
 * Handles Web Worker lifecycle for Instagram ZIP parsing
 */

import { logger } from '@/lib/logger';
import { useEffect, useRef } from 'react';

// Worker timeout constants (ms)
const WORKER_INIT_TIMEOUT_MS = 5000;

interface UseParseWorkerReturn {
  workerRef: React.MutableRefObject<Worker | null>;
  isWorkerReady: () => boolean;
}

/**
 * Initialize and manage parse worker lifecycle
 * Returns worker ref and ready check function
 */
export function useParseWorker(): UseParseWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);

  // Initialize Web Worker for file parsing
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Worker && !workerRef.current) {
      const initializeWorker = async () => {
        try {
          // Create TypeScript module worker directly
          try {
            const worker = new Worker(new URL('../lib/parse-worker.ts', import.meta.url), {
              type: 'module',
            });
            workerRef.current = worker;
          } catch (error) {
            throw new Error(
              `Failed to create worker: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { cause: error }
            );
          }

          // Wait for worker to be ready
          const readyHandler = (e: MessageEvent) => {
            if (e.data?.type === 'ready') {
              workerReadyRef.current = true;
              workerRef.current?.removeEventListener('message', readyHandler);
            }
          };

          workerRef.current.addEventListener('message', readyHandler);

          // Add global error handler
          workerRef.current.onerror = event => {
            const errorEvent = event as ErrorEvent;
            logger.error('Parse worker error:', {
              message: errorEvent?.message,
              filename: errorEvent?.filename,
              lineno: errorEvent?.lineno,
              colno: errorEvent?.colno,
            });
            if (typeof errorEvent?.preventDefault === 'function') {
              errorEvent.preventDefault();
            }
          };

          // Timeout to detect if worker doesn't respond
          setTimeout(() => {
            if (!workerReadyRef.current) {
              logger.warn('Parse worker initialization timeout, proceeding anyway');
              workerReadyRef.current = true;
            }
          }, WORKER_INIT_TIMEOUT_MS);
        } catch (error) {
          logger.error('Failed to initialize parse worker:', error);
        }
      };

      // Call the async function
      initializeWorker();
    }

    // Cleanup worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        workerReadyRef.current = false;
      }
    };
  }, []);

  const isWorkerReady = () => workerReadyRef.current;

  return {
    workerRef,
    isWorkerReady,
  };
}
