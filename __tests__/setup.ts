import { vi } from 'vitest';

vi.mock('neo4j-driver', () => ({
  default: {
    driver: vi.fn(() => ({
      session: vi.fn(() => ({
        run: vi.fn(),
        close: vi.fn(),
      })),
      close: vi.fn(),
      verifyConnectivity: vi.fn(),
    })),
    auth: {
      basic: vi.fn((user, pass) => ({ principal: user, credentials: pass })),
    },
  },
}));
