import { z } from 'zod';

import { fieldErrors } from './common';

/**
 * Request-body schemas.
 *
 * These mirror the API's own validation so most invalid input never reaches the
 * backend. They are a convenience, not the authority: the API validates again.
 */

export const loginBodySchema = z.object({
  // The API trims the username and rejects empty credentials.
  username: z.string().trim().min(1, 'Username is required').max(50, 'Username is too long'),
  password: z.string().min(1, 'Password is required').max(1024, 'Password is too long'),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

/**
 * Product bodies.
 *
 * Rules mirror the API exactly (`product_handler.go`): SKU is required and capped at 50
 * on create, and is NOT part of the update contract at all (the API ignores it), so the
 * edit form must never offer it as editable.
 */
const productName = z
  .string()
  .trim()
  .min(1, 'Product name is required')
  .max(200, 'Product name must not exceed 200 characters');

const productDescription = z
  .string()
  .trim()
  .max(1000, 'Description must not exceed 1000 characters')
  .optional();

const productUnit = z
  .string()
  .trim()
  .max(20, 'Unit must not exceed 20 characters')
  .optional();

const productMinStock = z.coerce
  .number()
  .int('Minimum stock must be a whole number')
  .min(0, 'Minimum stock cannot be negative')
  .max(2_147_483_647, 'Minimum stock is too large')
  .optional();

export const createProductBodySchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50, 'SKU must not exceed 50 characters'),
  name: productName,
  description: productDescription,
  unit: productUnit,
  min_stock: productMinStock,
});

export type CreateProductBody = z.infer<typeof createProductBodySchema>;

export const updateProductBodySchema = z.object({
  name: productName,
  description: productDescription,
  unit: productUnit,
  min_stock: productMinStock,
});

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

/**
 * Stock receipt body.
 *
 * `quantity` must be a strictly positive integer: the API rejects zero and negatives,
 * and a receipt can never move stock out. `notes` is optional and capped at 1000.
 */
export const createReceiptBodySchema = z.object({
  product_id: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'product_id must be a UUID',
  ),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(2_147_483_647, 'Quantity is too large'),
  notes: z.string().trim().max(1000, 'Notes must not exceed 1000 characters').optional(),
});

export type CreateReceiptBody = z.infer<typeof createReceiptBodySchema>;

/**
 * Stock request bodies.
 *
 * Mirrors the API: 1–100 line items, positive integer quantities, unique products, notes
 * ≤ 1000. Duplicates are rejected here so the user sees a field error instead of a round
 * trip — the API rejects them too (`DUPLICATE_ITEM`).
 */
export const stockRequestItemSchema = z.object({
  product_id: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'product_id must be a UUID',
  ),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(2_147_483_647, 'Quantity is too large'),
});

export const createStockRequestBodySchema = z
  .object({
    items: z
      .array(stockRequestItemSchema)
      .min(1, 'Add at least one product')
      .max(100, 'A request may contain at most 100 items'),
    notes: z.string().trim().max(1000, 'Notes must not exceed 1000 characters').optional(),
  })
  .refine(
    (value) => new Set(value.items.map((item) => item.product_id.toLowerCase())).size === value.items.length,
    { message: 'The same product appears more than once', path: ['items'] },
  );

export type CreateStockRequestBody = z.infer<typeof createStockRequestBodySchema>;

/** Optional review payloads: the API accepts an empty body for both. */
export const rejectRequestBodySchema = z.object({
  rejection_reason: z
    .string()
    .trim()
    .max(1000, 'Rejection reason must not exceed 1000 characters')
    .optional(),
});

export const cancelRequestBodySchema = z.object({
  reason: z.string().trim().max(1000, 'Reason must not exceed 1000 characters').optional(),
});

/**
 * Idempotency keys are only honoured by `POST /stock-requests/:id/issue`.
 * The API requires 8–100 characters from `A-Z a-z 0-9 . _ : -`.
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

export function isIdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(value);
}

export type BodyParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'BAD_JSON' | 'VALIDATION'; fields?: Record<string, string> };

/** Parses a JSON body string against a schema. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  bodyText: string,
): BodyParseResult<z.infer<T>> {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return { ok: false, code: 'BAD_JSON' };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, code: 'VALIDATION', fields: fieldErrors(result.error) };
  }
  return { ok: true, value: result.data };
}
