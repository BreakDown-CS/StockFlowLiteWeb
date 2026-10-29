'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys, queryPrefixes } from '@/lib/query/keys';

import {
  createProduct,
  deactivateProduct,
  fetchProduct,
  fetchProducts,
  updateProduct,
} from './api';
import type { CreateProductInput, ProductQuery, UpdateProductInput } from './types';

/**
 * Product queries and mutations.
 *
 * Every write invalidates the product domain and the report domain: a stock or
 * active-state change also changes the dashboard counters and the low-stock table.
 */
export function useProducts(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.products(query as Record<string, unknown>),
    queryFn: ({ signal }) => fetchProducts(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ''),
    queryFn: ({ signal }) => fetchProduct(id as string, signal),
    enabled: Boolean(id),
  });
}

function useInvalidateProductDomain() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryPrefixes.products }),
      queryClient.invalidateQueries({ queryKey: queryPrefixes.reports }),
    ]);
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProductDomain();
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateProductDomain();
  return useMutation({
    mutationFn: (input: UpdateProductInput) => updateProduct(id, input),
    onSuccess: invalidate,
  });
}

export function useDeactivateProduct() {
  const invalidate = useInvalidateProductDomain();
  return useMutation({
    mutationFn: (id: string) => deactivateProduct(id),
    onSuccess: invalidate,
  });
}
