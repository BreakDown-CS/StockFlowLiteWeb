import { z } from 'zod';

import {
  booleanQuerySchema,
  isoDateTimeSchema,
  limitSchema,
  offsetSchema,
  searchSchema,
  triStateSchema,
  uuidSchema,
} from './common';

/**
 * Query allowlists, one per BFF route.
 *
 * Each schema is the complete set of parameters the frontend supports. Anything else is
 * stripped, so a caller cannot reach an upstream parameter the UI never modelled.
 */

/** GET /api/bff/reports/inventory */
export const inventoryReportQuerySchema = z.object({
  search: searchSchema,
  is_active: triStateSchema,
  low_stock: booleanQuerySchema,
  limit: limitSchema,
  offset: offsetSchema,
});

export type InventoryReportQuery = z.infer<typeof inventoryReportQuerySchema>;

/**
 * GET /api/bff/products
 *
 * `is_active` accepts true/false/all, matching the API. The BFF never asks for more than
 * 100 rows: `/products` does not clamp `limit` before echoing it in `meta`, so a larger
 * request would report a page size it did not deliver.
 */
export const productsQuerySchema = z.object({
  search: searchSchema,
  is_active: triStateSchema,
  limit: limitSchema,
  offset: offsetSchema,
});

export type ProductsQuery = z.infer<typeof productsQuerySchema>;

/**
 * GET /api/bff/stock-requests
 *
 * `status` is the ONLY filter the API supports here — there is no date range and no
 * search on this endpoint, so none is offered.
 */
export const stockRequestsQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'CANCELLED']).optional(),
  ),
  limit: limitSchema,
  offset: offsetSchema,
});

export type StockRequestsQuery = z.infer<typeof stockRequestsQuerySchema>;

/** GET /api/bff/reports/stock-movements (used from Phase F6) */
export const movementReportQuerySchema = z.object({
  product_id: uuidSchema.optional(),
  movement_type: z
    .preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT']).optional(),
    )
    .optional(),
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  limit: limitSchema,
  offset: offsetSchema,
});

/** GET /api/bff/reports/stock-requests (used from Phase F6) */
export const requestReportQuerySchema = z.object({
  status: z
    .preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z
        .enum(['PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'CANCELLED'])
        .optional(),
    )
    .optional(),
  requester_id: uuidSchema.optional(),
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  limit: limitSchema,
  offset: offsetSchema,
});
