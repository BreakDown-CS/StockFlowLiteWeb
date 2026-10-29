'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys, queryPrefixes } from '@/lib/query/keys';

import {
  approveRequest,
  cancelRequest,
  createRequest,
  fetchRequest,
  fetchRequests,
  issueRequest,
  rejectRequest,
} from './api';
import type { CreateRequestInput, IssueResult, StockRequestQuery } from './types';

export function useRequests(query: StockRequestQuery) {
  return useQuery({
    queryKey: queryKeys.requests(query as Record<string, unknown>),
    queryFn: ({ signal }) => fetchRequests(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.request(id ?? ''),
    queryFn: ({ signal }) => fetchRequest(id as string, signal),
    enabled: Boolean(id),
  });
}

/**
 * Any workflow step can move stock and change counters, so the request, movement, report
 * and product domains are all invalidated together.
 */
function useInvalidateWorkflow() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryPrefixes.requests }),
      queryClient.invalidateQueries({ queryKey: queryPrefixes.movements }),
      queryClient.invalidateQueries({ queryKey: queryPrefixes.reports }),
      queryClient.invalidateQueries({ queryKey: queryPrefixes.products }),
    ]);
  };
}

export function useCreateRequest() {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: (input: CreateRequestInput) => createRequest(input),
    onSuccess: invalidate,
  });
}

export function useApproveRequest() {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: (id: string) => approveRequest(id),
    onSuccess: invalidate,
  });
}

export function useRejectRequest() {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: (variables: { id: string; reason?: string }) =>
      rejectRequest(variables.id, variables.reason),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: (variables: { id: string; reason?: string }) =>
      cancelRequest(variables.id, variables.reason),
    onSuccess: invalidate,
  });
}

export function useIssueRequest() {
  const invalidate = useInvalidateWorkflow();
  return useMutation<IssueResult, Error, { id: string; idempotencyKey: string }>({
    mutationFn: (variables) => issueRequest(variables.id, variables.idempotencyKey),
    onSuccess: invalidate,
  });
}
