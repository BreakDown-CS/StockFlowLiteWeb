/**
 * Transport envelope.
 *
 * Mirrors the backend response envelope 1:1 (see backend `pkg/response/response.go`,
 * verified in Phase FE-1). The backend stays the source of truth; the frontend never
 * invents a competing response shape.
 *
 *   success: { success: true,  message?: string, data: T, meta?: M }
 *   failure: { success: false, error: { code, message, details? } }
 */
export type PageMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T, M = never> = {
  success: true;
  data: T;
  message?: string;
  meta?: M;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorBody;
};

export type ApiEnvelope<T, M = never> = ApiSuccess<T, M> | ApiFailure;

/** Narrowing helper: a plain object (not an array, not null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the value looks like a failed envelope. */
export function isFailure(value: unknown): value is ApiFailure {
  if (!isRecord(value) || value.success !== false) {
    return false;
  }
  const error = value.error;
  return isRecord(error) && typeof error.code === 'string' && typeof error.message === 'string';
}

/** True when the value looks like a successful envelope. */
export function isSuccess<T>(value: unknown): value is ApiSuccess<T, unknown> {
  return isRecord(value) && value.success === true && 'data' in value;
}

/** True when the value is a list pagination block. */
export function isPageMeta(value: unknown): value is PageMeta {
  return (
    isRecord(value) &&
    typeof value.limit === 'number' &&
    typeof value.offset === 'number' &&
    typeof value.total === 'number'
  );
}

/**
 * Asserts that an unknown payload is a StockFlow envelope.
 *
 * @throws TypeError when the payload is not an envelope at all (for example an
 * upstream HTML error page or a plain-text 404 body).
 */
export function parseEnvelope<T>(payload: unknown): ApiEnvelope<T, PageMeta> {
  if (isFailure(payload)) {
    return payload;
  }
  if (isSuccess<T>(payload)) {
    return payload as ApiEnvelope<T, PageMeta>;
  }
  throw new TypeError('Response payload is not a StockFlow API envelope');
}
