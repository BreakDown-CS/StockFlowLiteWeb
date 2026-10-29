/**
 * Stock request DTOs (wire) and view models.
 * Mirrors `internal/domain/stock_request.go` and `stock_issuance.go`.
 */

export const REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ISSUED',
  'CANCELLED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type StockRequestItemDTO = {
  id: string;
  request_id: string;
  product_id: string;
  requested_quantity: number;
};

export type StockRequestIssuanceDTO = {
  id: string;
  request_id: string;
  idempotency_key?: string;
  actor_id?: string;
  item_count: number;
  total_quantity: number;
  created_at: string;
};

export type StockRequestDTO = {
  id: string;
  request_number: string;
  requester_id: string;
  status: RequestStatus;
  notes?: string;
  reviewer_id?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  items?: StockRequestItemDTO[];
  issuance?: StockRequestIssuanceDTO;
};

export type StockRequestItem = {
  id: string;
  productId: string;
  requestedQuantity: number;
};

export type StockRequestIssuance = {
  id: string;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
};

export type StockRequest = {
  id: string;
  requestNumber: string;
  requesterId: string;
  status: RequestStatus;
  notes: string;
  reviewerId: string;
  reviewedAt: string | null;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
  items: StockRequestItem[];
  issuance: StockRequestIssuance | null;
};

export type StockRequestQuery = {
  status?: RequestStatus;
  limit?: number;
  offset?: number;
};

/** Create payload (view model → body mapping happens in mappers.ts). */
export type CreateRequestInput = {
  items: Array<{ productId: string; quantity: number }>;
  notes?: string;
};

/** A single unfulfillable line returned inside `error.details.items`. */
export type StockShortage = {
  productId: string;
  requested: number;
  available: number;
  shortfall: number;
};

/** Result of an idempotent issue call. */
export type IssueResult = {
  request: StockRequest;
  /** How many ISSUE movements the issuance wrote (one per item). */
  movementsCount: number;
  idempotentReplay: boolean;
  issuanceId: string | null;
};

export type StockIssueResultDTO = {
  request: StockRequestDTO;
  movements: Array<{ id: number; product_id: string; quantity: number }>;
  issuance?: StockRequestIssuanceDTO;
};

export type IssueMeta = {
  idempotent_replay?: boolean;
  issuance_id?: string;
  issued_at?: string;
};
