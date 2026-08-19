import '@testing-library/jest-dom';
import '@vitest/web-worker';

// Import modular mocks
import { setupI18nMocks } from './vitest/i18n-mock';
import { setupBrowserMocks } from './vitest/browser-mocks';
import { setupFileMock } from './vitest/file-mock';
import { setupStorageMocks } from './vitest/storage-mock';
import { setupBlobPolyfill } from './vitest/blob-polyfill';

// Setup all mocks
setupI18nMocks();
setupBrowserMocks();
setupFileMock();
setupStorageMocks();
// A polyfill, not a mock: jsdom's Blob lacks arrayBuffer/text, which browsers
// have had since 2020 and the ZIP reader needs.
setupBlobPolyfill();

// Note: Worker is now provided by @vitest/web-worker for realistic testing
