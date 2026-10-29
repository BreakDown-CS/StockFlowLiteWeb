import { z } from 'zod';

/**
 * Pure environment schema (no `server-only` import) so it can be unit-tested.
 *
 * Every value except `NEXT_PUBLIC_APP_NAME` is server-only. `NEXT_PUBLIC_*` values are
 * inlined into the client bundle at build time, so secrets must never use that prefix.
 */

/** Absolute http(s) URL, normalised by stripping trailing slashes. */
const httpUrl = z
  .string()
  .min(1, 'must not be empty')
  .refine((value) => /^https?:\/\/\S+$/i.test(value), {
    message: 'must be an absolute http(s) URL',
  })
  .transform((value) => value.replace(/\/+$/, ''));

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Upstream Go API. Server-to-server only.
  BACKEND_API_URL: httpUrl,

  // Exact public origin of this app, used for cookie/CSRF origin checks.
  APP_ORIGIN: httpUrl,

  // AES-256-GCM key material for the session cookie.
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  /**
   * Optional. When omitted it defaults to `NODE_ENV === 'production'`, which is the
   * safe default in every environment:
   *   - development (plain HTTP on loopback) → false, so the cookie is usable;
   *   - `next build` / `next start` (NODE_ENV=production) → true, so a build never
   *     silently produces an insecure cookie.
   * Setting it explicitly to "false" in production is rejected below.
   */
  SESSION_COOKIE_SECURE: z.enum(['true', 'false']).optional(),

  BACKEND_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(1_000).default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  DEFAULT_REPORT_RANGE_DAYS: z.coerce.number().int().positive().max(365).default(30),

  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('StockFlow Lite'),
});

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  backendApiUrl: string;
  appOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  backendTimeoutMs: number;
  loginRateLimitMax: number;
  loginRateLimitWindowMs: number;
  defaultReportRangeDays: number;
  appName: string;
};

/**
 * Validates and normalises the process environment.
 *
 * @throws Error with one line per invalid variable, so a misconfigured deployment
 * fails fast at boot instead of at the first request.
 */
export function parseEnv(source: Record<string, string | undefined>): AppEnv {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const raw = parsed.data;

  if (raw.NODE_ENV === 'production' && raw.SESSION_COOKIE_SECURE === 'false') {
    throw new Error(
      'Invalid environment configuration:\n' +
        '  - SESSION_COOKIE_SECURE must be "true" when NODE_ENV=production',
    );
  }

  const cookieSecure =
    raw.SESSION_COOKIE_SECURE === undefined
      ? raw.NODE_ENV === 'production'
      : raw.SESSION_COOKIE_SECURE === 'true';

  return {
    nodeEnv: raw.NODE_ENV,
    backendApiUrl: raw.BACKEND_API_URL,
    appOrigin: raw.APP_ORIGIN,
    sessionSecret: raw.SESSION_SECRET,
    cookieSecure,
    backendTimeoutMs: raw.BACKEND_TIMEOUT_MS,
    loginRateLimitMax: raw.LOGIN_RATE_LIMIT_MAX,
    loginRateLimitWindowMs: raw.LOGIN_RATE_LIMIT_WINDOW_MS,
    defaultReportRangeDays: raw.DEFAULT_REPORT_RANGE_DAYS,
    appName: raw.NEXT_PUBLIC_APP_NAME,
  };
}
