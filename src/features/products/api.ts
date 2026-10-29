import { bffRequest } from '@/lib/api/bff-client';
import type { PageMeta } from '@/lib/api/envelope';

import { toCreateProductBody, toProduct, toUpdateProductBody } from './mappers';
import type {
  CreateProductInput,
  Product,
  ProductDTO,
  ProductQuery,
  UpdateProductInput,
} from './types';

/** Product API calls (browser → BFF → Go API). */

export type ProductListResult = {
  items: Product[];
  meta?: PageMeta;
};

function toSearchParams(query: ProductQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.isActive) {
    params.set('is_active', query.isActive);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }

  return params;
}

export async function fetchProducts(
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<ProductListResult> {
  const search = toSearchParams(query).toString();
  const path = search.length > 0 ? `/api/bff/products?${search}` : '/api/bff/products';

  const response = await bffRequest<ProductDTO[]>(path, { signal });

  return {
    items: response.data.map(toProduct),
    meta: response.meta as PageMeta | undefined,
  };
}

export async function fetchProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const response = await bffRequest<ProductDTO>(`/api/bff/products/${id}`, { signal });
  return toProduct(response.data);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const response = await bffRequest<ProductDTO>('/api/bff/products', {
    method: 'POST',
    body: toCreateProductBody(input),
  });
  return toProduct(response.data);
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const response = await bffRequest<ProductDTO>(`/api/bff/products/${id}`, {
    method: 'PUT',
    body: toUpdateProductBody(input),
  });
  return toProduct(response.data);
}

export async function deactivateProduct(id: string): Promise<void> {
  await bffRequest(`/api/bff/products/${id}/deactivate`, { method: 'PATCH' });
}
