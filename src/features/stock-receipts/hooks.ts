'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryPrefixes } from '@/lib/query/keys';

import { createReceipt } from './api';
import type { ReceiptInput } from './types';

/**
 * Receipt mutation.
 *
 * A receipt changes stock, appends a ledger row and moves the dashboard counters, so the
 * product, movement and report domains are all invalidated.
 */
export function useCreateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReceiptInput) => createReceipt(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryPrefixes.products }),
        queryClient.invalidateQueries({ queryKey: queryPrefixes.movements }),
        queryClient.invalidateQueries({ queryKey: queryPrefixes.reports }),
      ]);
    },
  });
}
