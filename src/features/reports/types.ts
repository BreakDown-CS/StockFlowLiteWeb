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

/** Query shape accepted by the BFF route (already validated there). */
export type InventoryQuery = {
  search?: string;
  isActive?: 'true' | 'false' | 'all';
  lowStock?: boolean;
  limit?: number;
  offset?: number;
};
