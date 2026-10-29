/** Stock movement DTOs (wire) and view models. Mirrors `internal/domain/stock_movement.go`. */

export const MOVEMENT_TYPES = ['RECEIPT', 'ISSUE', 'ADJUSTMENT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Raw ledger row from `GET /stock-movements` (product_id only, unsigned quantity). */
export type StockMovementDTO = {
  id: number;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type: string;
  reference_id?: string;
  actor_id?: string;
  notes?: string;
  created_at: string;
};

/** Enriched row from `GET /reports/stock-movements` — the one the ledger renders. */
export type MovementReportRowDTO = {
  id: number;
  product_id: string;
  sku: string;
  product_name: string;
  movement_type: MovementType;
  quantity: number;
  signed_quantity: number;
  reference_type: string;
  reference_id?: string;
  actor_id?: string;
  notes?: string;
  created_at: string;
};

export type MovementSummaryDTO = {
  movement_count: number;
  receipt_total_quantity: number;
  issue_total_quantity: number;
  adjustment_total_quantity: number;
  net_change: number;
};

export type MovementReportDTO = {
  summary: MovementSummaryDTO;
  items: MovementReportRowDTO[];
};

export type StockMovement = {
  id: number;
  productId: string;
  movementType: MovementType;
  /** Always positive on the wire; the type decides direction. */
  quantity: number;
  signedQuantity: number;
  sku: string;
  productName: string;
  referenceType: string;
  referenceId: string;
  actorId: string;
  notes: string;
  createdAt: string;
};

export type MovementSummary = {
  movementCount: number;
  receiptTotalQuantity: number;
  issueTotalQuantity: number;
  adjustmentTotalQuantity: number;
  netChange: number;
};

export type MovementReport = {
  summary: MovementSummary;
  items: StockMovement[];
};

export type MovementQuery = {
  productId?: string;
  movementType?: MovementType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
