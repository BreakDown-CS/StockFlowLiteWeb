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
    coverage: {
      provider: 'v8',
      /**
       * Scope: the PURE trust-boundary modules, i.e. the ones that can be reasoned about
       * without a Next.js runtime. Runtime-bound modules (`forward`, `session`, `backend`,
       * `respond`, `body-guard`, `bff-client`) are exercised end to end by
       * `npm run smoke:auth` / `smoke:workflow` and by the Playwright suite instead —
       * measuring them here would just report zeros for code a unit test cannot reach.
       */
      include: [
        'src/lib/api/envelope.ts',
        'src/lib/api/errors.ts',
        'src/lib/api/messages.ts',
        'src/lib/format/**/*.ts',
        'src/lib/rbac/**/*.ts',
        'src/lib/validation/**/*.ts',
        'src/lib/server/session-crypto.ts',
        'src/lib/server/csrf.ts',
        'src/lib/server/rate-limit.ts',
        'src/lib/server/env-schema.ts',
      ],
      reporter: ['text-summary', 'text'],
    },
  },
});
