/**
 * Boot-time environment validation.
 *
 * Next calls `register()` once when the server starts (dev and production). Validating
 * here means a missing/short SESSION_SECRET or a bad BACKEND_API_URL fails immediately
 * with a readable message instead of surfacing as a confusing 500 on the first request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    // Edge runtime has no access to the server-only environment module.
    return;
  }

  const { getEnv } = await import('@/lib/server/env');
  const env = getEnv();

  console.info(
    `[stockflow] environment validated (${env.nodeEnv}); backend=${env.backendApiUrl}; origin=${env.appOrigin}`,
  );
}
