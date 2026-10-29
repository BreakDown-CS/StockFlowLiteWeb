import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit-test harness.
 *
 * Tests target the trust boundary (`src/lib/**`): envelope parsing, error
 * normalisation, session crypto, CSRF, validation schemas and the RBAC matrix.
 * DOM-level component tests opt into the jsdom environment per file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default'],
  },
});
