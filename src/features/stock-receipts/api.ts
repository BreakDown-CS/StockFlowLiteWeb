import { toProduct } from '@/features/products/mappers';
import { bffRequest } from '@/lib/api/bff-client';

import type { ReceiptBody, ReceiptInput, ReceiptResult, ReceiptResultDTO } from './types';

function toReceiptBody(input: ReceiptInput): ReceiptBody {
  const body: ReceiptBody = {
    product_id: input.productId,
    quantity: input.quantity,
  };

  const notes = input.notes?.trim();
  if (notes) {
    body.notes = notes;
  }

  return body;
}

export async function createReceipt(input: ReceiptInput): Promise<ReceiptResult> {
  const response = await bffRequest<ReceiptResultDTO>('/api/bff/stock-receipts', {
    method: 'POST',
    body: toReceiptBody(input),
  });

  return {
    product: toProduct(response.data.product),
    movementId: response.data.movement.id,
    quantity: response.data.movement.quantity,
  };
}

export { toReceiptBody };
