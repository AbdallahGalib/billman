import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock IndexedDB
const indexedDBMock = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    clipboard: {
      writeText: vi.fn()
    }
  }
});

// Mock URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: vi.fn(() => 'mock-url')
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: vi.fn()
});

// Mock FileReader
global.FileReader = class {
  result: string | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.result = 'mock file content';
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
} as any;

// Mock environment variables
vi.mock('$env/static/private', () => ({
  VITE_SUPABASE_URL: 'https://mock-supabase-url.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'mock-supabase-key'
}));