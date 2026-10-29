import type {
  CreateRequestInput,
  StockRequest,
  StockRequestDTO,
  StockRequestIssuance,
  StockRequestItem,
  StockShortage,
} from './types';

/** Pure DTO ↔ view-model mappers for the request workflow. */

function toIssuance(
  dto: StockRequestDTO['issuance'],
): StockRequestIssuance | null {
  if (!dto) {
    return null;
  }
  return {
    id: dto.id,
    itemCount: dto.item_count,
    totalQuantity: dto.total_quantity,
    createdAt: dto.created_at,
  };
}

export function toStockRequestItem(
  dto: NonNullable<StockRequestDTO['items']>[number],
): StockRequestItem {
  return {
    id: dto.id,
    productId: dto.product_id,
    requestedQuantity: dto.requested_quantity,
  };
}

export function toStockRequest(dto: StockRequestDTO): StockRequest {
  return {
    id: dto.id,
    requestNumber: dto.request_number,
    requesterId: dto.requester_id,
    status: dto.status,
    notes: dto.notes ?? '',
    reviewerId: dto.reviewer_id ?? '',
    reviewedAt: dto.reviewed_at ?? null,
    rejectionReason: dto.rejection_reason ?? '',
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    items: (dto.items ?? []).map(toStockRequestItem),
    issuance: toIssuance(dto.issuance),
  };
}

/** Body for POST /stock-requests. */
export function toCreateRequestBody(input: CreateRequestInput): {
  items: Array<{ product_id: string; quantity: number }>;
  notes?: string;
} {
  const body: { items: Array<{ product_id: string; quantity: number }>; notes?: string } = {
    items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
  };

  const notes = input.notes?.trim();
  if (notes) {
    body.notes = notes;
  }

  return body;
}

/**
 * Extracts per-item shortages from an INSUFFICIENT_STOCK error.
 *
 * The API returns `error.details.items = [{product_id, requested, available, shortfall}]`
 * and deducts nothing when any line is short — the UI must show every line, not just the
 * first failure.
 */
export function toShortages(details: unknown): StockShortage[] {
  if (typeof details !== 'object' || details === null) {
    return [];
  }
  const items = (details as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.product_id !== 'string' ||
      typeof candidate.requested !== 'number' ||
      typeof candidate.available !== 'number' ||
      typeof candidate.shortfall !== 'number'
    ) {
      return [];
    }
    return [
      {
        productId: candidate.product_id,
        requested: candidate.requested,
        available: candidate.available,
        shortfall: candidate.shortfall,
      },
    ];
  });
}
