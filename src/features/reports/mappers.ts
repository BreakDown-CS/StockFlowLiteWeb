import type {
  InventoryItem,
  InventoryReport,
  InventoryReportDTO,
  InventoryRowDTO,
  InventorySummary,
  InventorySummaryDTO,
  RequestReport,
  RequestReportDTO,
  RequestReportRow,
  RequestReportRowDTO,
  RequestSummary,
  RequestSummaryDTO,
} from './types';

/** Pure DTO → view-model mappers (unit-tested; the only snake_case boundary). */

export function toInventoryItem(dto: InventoryRowDTO): InventoryItem {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    unit: dto.unit,
    currentStock: dto.current_stock,
    minStock: dto.min_stock,
    isActive: dto.is_active,
    isLowStock: dto.is_low_stock,
    isOutOfStock: dto.is_out_of_stock,
    updatedAt: dto.updated_at,
  };
}

export function toInventorySummary(dto: InventorySummaryDTO): InventorySummary {
  return {
    totalProducts: dto.total_products,
    activeProducts: dto.active_products,
    inactiveProducts: dto.inactive_products,
    lowStockProducts: dto.low_stock_products,
    outOfStockProducts: dto.out_of_stock_products,
  };
}

export function toInventoryReport(dto: InventoryReportDTO): InventoryReport {
  return {
    summary: toInventorySummary(dto.summary),
    items: dto.items.map(toInventoryItem),
  };
}

export function toRequestReportRow(dto: RequestReportRowDTO): RequestReportRow {
  return {
    id: dto.id,
    requestNumber: dto.request_number,
    status: dto.status,
    requesterId: dto.requester_id,
    requesterUsername: dto.requester_username,
    itemCount: dto.item_count,
    requestedUnits: dto.requested_units,
    issuedUnits: dto.issued_units,
    createdAt: dto.created_at,
    reviewedAt: dto.reviewed_at ?? null,
    issuedAt: dto.issued_at ?? null,
    rejectionReason: dto.rejection_reason ?? '',
    cancellationReason: dto.cancellation_reason ?? '',
  };
}

export function toRequestSummary(dto: RequestSummaryDTO): RequestSummary {
  return {
    totalRequests: dto.total_requests,
    pendingRequests: dto.pending_requests,
    approvedRequests: dto.approved_requests,
    rejectedRequests: dto.rejected_requests,
    issuedRequests: dto.issued_requests,
    cancelledRequests: dto.cancelled_requests,
    requestedUnitsTotal: dto.requested_units_total,
    issuedUnitsTotal: dto.issued_units_total,
  };
}

export function toRequestReport(dto: RequestReportDTO): RequestReport {
  return {
    summary: toRequestSummary(dto.summary),
    items: dto.items.map(toRequestReportRow),
  };
}
