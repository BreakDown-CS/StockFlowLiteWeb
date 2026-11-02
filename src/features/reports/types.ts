/**
 * Inventory report DTOs (wire shapes, `snake_case`) and view models (`camelCase`).
 *
 * The DTO types mirror the Go structs in `internal/domain/report.go` exactly; mappers
 * convert them at the feature boundary so UI code never depends on wire naming.
 */

export type InventoryRowDTO = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  updated_at: string;
};

export type InventorySummaryDTO = {
  total_products: number;
  active_products: number;
  inactive_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
};

export type InventoryReportDTO = {
  summary: InventorySummaryDTO;
  items: InventoryRowDTO[];
};

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  updatedAt: string;
};

export type InventorySummary = {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

export type InventoryReport = {
  summary: InventorySummary;
  items: InventoryItem[];
};

/** Request report (enriched rows with fulfilment aggregates). */
export type RequestReportRowDTO = {
  id: string;
  request_number: string;
  status: string;
  requester_id: string;
  requester_username: string;
  item_count: number;
  requested_units: number;
  issued_units: number;
  created_at: string;
  reviewed_at?: string;
  issued_at?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
};

export type RequestSummaryDTO = {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  issued_requests: number;
  cancelled_requests: number;
  requested_units_total: number;
  issued_units_total: number;
};

export type RequestReportDTO = {
  summary: RequestSummaryDTO;
  items: RequestReportRowDTO[];
};

export type RequestReportRow = {
  id: string;
  requestNumber: string;
  status: string;
  requesterId: string;
  requesterUsername: string;
  itemCount: number;
  requestedUnits: number;
  issuedUnits: number;
  createdAt: string;
  reviewedAt: string | null;
  issuedAt: string | null;
  rejectionReason: string;
  cancellationReason: string;
};

export type RequestSummary = {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  issuedRequests: number;
  cancelledRequests: number;
  requestedUnitsTotal: number;
  issuedUnitsTotal: number;
};

export type RequestReport = {
  summary: RequestSummary;
  items: RequestReportRow[];
};

export type RequestReportQuery = {
  status?: string;
  requesterId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};


/** Query shape accepted by the BFF route (already validated there). */
export type InventoryQuery = {
  search?: string;
  isActive?: 'true' | 'false' | 'all';
  lowStock?: boolean;
  limit?: number;
  offset?: number;
};
