import type { Product, ProductDTO } from '@/features/products/types';
import type { StockMovementDTO } from '@/features/stock-movements/types';

/** Receipt request/response shapes (`POST /stock-receipts` → 201). */

export type ReceiptInput = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type ReceiptBody = {
  product_id: string;
  quantity: number;
  notes?: string;
};

export type ReceiptResultDTO = {
  product: ProductDTO;
  movement: StockMovementDTO;
};

export type ReceiptResult = {
  product: Product;
  /** Id of the ledger row that was appended. */
  movementId: number;
  quantity: number;
};
