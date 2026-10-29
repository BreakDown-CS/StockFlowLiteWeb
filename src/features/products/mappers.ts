import type {
  CreateProductBody,
  CreateProductInput,
  Product,
  ProductDTO,
  UpdateProductBody,
  UpdateProductInput,
} from './types';

/** Pure DTO → view-model and view-model → body mappers. */

export function toProduct(dto: ProductDTO): Product {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    description: dto.description ?? '',
    unit: dto.unit,
    currentStock: dto.current_stock,
    minStock: dto.min_stock,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

/** Omits blank optional fields so the API falls back to its own defaults. */
export function toCreateProductBody(input: CreateProductInput): CreateProductBody {
  const body: CreateProductBody = {
    sku: input.sku.trim(),
    name: input.name.trim(),
  };

  const description = input.description?.trim();
  if (description) {
    body.description = description;
  }

  const unit = input.unit?.trim();
  if (unit) {
    body.unit = unit;
  }

  if (input.minStock !== undefined) {
    body.min_stock = input.minStock;
  }

  return body;
}

export function toUpdateProductBody(input: UpdateProductInput): UpdateProductBody {
  const body: UpdateProductBody = {
    name: input.name.trim(),
  };

  // Description is sent even when empty: the API treats it as a full replacement, so
  // clearing the field must actually clear it.
  body.description = input.description?.trim() ?? '';

  const unit = input.unit?.trim();
  if (unit) {
    body.unit = unit;
  }

  if (input.minStock !== undefined) {
    body.min_stock = input.minStock;
  }

  return body;
}
