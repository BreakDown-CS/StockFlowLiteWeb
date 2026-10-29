import type {
  MovementReport,
  MovementReportDTO,
  MovementReportRowDTO,
  MovementSummary,
  MovementSummaryDTO,
  MovementType,
  StockMovement,
} from './types';

/**
 * Signed quantity for a movement type.
 *
 * Mirrors the backend's `NetQuantityChange()`: receipts and adjustments add, issues
 * subtract. The report endpoint already sends `signed_quantity`; this helper exists for
 * the raw `/stock-movements` endpoint (which sends an unsigned quantity) and is
 * unit-tested so the sign rule is never re-invented per component.
 */
export function signedQuantityFor(type: MovementType, quantity: number): number {
  switch (type) {
    case 'RECEIPT':
    case 'ADJUSTMENT':
      return quantity;
    case 'ISSUE':
      return -quantity;
    default:
      return 0;
  }
}

export function toStockMovement(dto: MovementReportRowDTO): StockMovement {
  return {
    id: dto.id,
    productId: dto.product_id,
    movementType: dto.movement_type,
    quantity: dto.quantity,
    signedQuantity: dto.signed_quantity,
    sku: dto.sku,
    productName: dto.product_name,
    referenceType: dto.reference_type,
    referenceId: dto.reference_id ?? '',
    actorId: dto.actor_id ?? '',
    notes: dto.notes ?? '',
    createdAt: dto.created_at,
  };
}

export function toMovementSummary(dto: MovementSummaryDTO): MovementSummary {
  return {
    movementCount: dto.movement_count,
    receiptTotalQuantity: dto.receipt_total_quantity,
    issueTotalQuantity: dto.issue_total_quantity,
    adjustmentTotalQuantity: dto.adjustment_total_quantity,
    netChange: dto.net_change,
  };
}

export function toMovementReport(dto: MovementReportDTO): MovementReport {
  return {
    summary: toMovementSummary(dto.summary),
    items: dto.items.map(toStockMovement),
  };
}
