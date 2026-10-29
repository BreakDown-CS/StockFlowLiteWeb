/**
 * Product DTOs (wire shapes) and view models.
 * DTOs mirror `internal/domain/product.go`; mappers own the snake_case boundary.
 */

export type ProductDTO = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductQuery = {
  search?: string;
  isActive?: 'true' | 'false' | 'all';
  limit?: number;
  offset?: number;
};

export type CreateProductInput = {
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  minStock?: number;
};

export type UpdateProductInput = {
  name: string;
  description?: string;
  unit?: string;
  minStock?: number;
};

/** Body shapes sent to the BFF (snake_case, matching the API). */
export type CreateProductBody = {
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  min_stock?: number;
};

export type UpdateProductBody = {
  name: string;
  description?: string;
  unit?: string;
  min_stock?: number;
};
