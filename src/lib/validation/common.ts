import { z } from 'zod';

/**
 * Reusable zod primitives for query-string validation at the BFF boundary.
 *
 * Query values arrive as strings and are untrusted. Every schema here is an
 * allowlist: `z.object` strips unknown keys, so a caller cannot smuggle parameters
 * through the proxy that the frontend did not explicitly support.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Any RFC 4122 UUID (the API currently issues v4). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `''` and missing values are treated the same, so empty inputs fall back to defaults. */
function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === null) {
    return undefined;
  }
  return value;
}

export const uuidSchema = z.string().regex(UUID_PATTERN, 'must be a UUID');

/** Route-parameter guard: the value never reaches the API unless it is a UUID. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export const limitSchema = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int('must be an integer')
    .min(1, 'must be at least 1')
    .max(MAX_PAGE_SIZE, `must not exceed ${MAX_PAGE_SIZE}`)
    .optional(),
);

export const offsetSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int('must be an integer').min(0, 'must not be negative').optional(),
);

export const searchSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(200, 'must not exceed 200 characters').optional(),
);

export const isoDateTimeSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an RFC3339 timestamp')
    .optional(),
);

export const triStateSchema = z.preprocess(
  emptyToUndefined,
  z.enum(['true', 'false', 'all']).optional(),
);

/** Strict two-state flag (for filters that do not support `all`). */
export const booleanQuerySchema = z.preprocess(
  emptyToUndefined,
  z.enum(['true', 'false']).optional(),
);

/** Flattens zod issues into `{ path: message }` for field-level UI errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

/**
 * Validates a URLSearchParams object against a schema.
 *
 * @returns the parsed value, or `{ ok: false, fields }` so the caller can return a
 * `VALIDATION_ERROR` envelope consistent with the API's own error vocabulary.
 */
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  params: URLSearchParams,
): { ok: true; value: z.infer<T> } | { ok: false; fields: Record<string, string> } {
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, fields: fieldErrors(result.error) };
  }
  return { ok: true, value: result.data };
}
