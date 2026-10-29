import 'server-only';

import { parseEnv, type AppEnv } from './env-schema';

/**
 * Server-only environment accessor.
 *
 * `import 'server-only'` makes any client-component import a build error, which is how
 * `SESSION_SECRET` / `BACKEND_API_URL` are kept out of the browser bundle.
 *
 * Values are parsed once and cached. Boot-time validation happens in
 * `src/instrumentation.ts`, so a misconfigured deployment fails at startup rather than
 * at the first request.
 */
let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test helper: clears the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
