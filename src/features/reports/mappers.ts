import type {
  InventoryItem,
  InventoryReport,
  InventoryReportDTO,
  InventoryRowDTO,
  InventorySummary,
  InventorySummaryDTO,
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
