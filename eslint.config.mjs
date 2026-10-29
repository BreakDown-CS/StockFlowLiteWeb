import next from 'eslint-config-next';

/**
 * Flat ESLint config.
 *
 * `eslint-config-next` v16 exports a flat config array, so it is spread directly.
 * Build output and generated files are ignored; nothing else is suppressed.
 *
 * @type {import('eslint').Linter.Config[]}
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'out/**',
      'next-env.d.ts',
      '**/*.d.ts',
    ],
  },
  ...next,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Structured logging goes through lib/server/logger.ts; console is allowed
      // only for boot-time diagnostics.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
];

export default config;
