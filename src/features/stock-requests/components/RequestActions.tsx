'use client';

import { useRef, useState } from 'react';
import { Alert, App, Button, Flex, Input, Space, Typography } from 'antd';

import { useCan, useSession } from '@/features/auth/session-context';
import type { Product } from '@/features/products/types';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';
import { canIssueRequest, canReviewRequest } from '@/lib/rbac/permissions';

import { useApproveRequest, useCancelRequest, useIssueRequest, useRejectRequest } from '../hooks';
import { toShortages } from '../mappers';
import type { StockRequest, StockShortage } from '../types';
import { ShortageAlert } from './ShortageAlert';

/**
 * Workflow actions for a single request.
 *
 * Two rules decide what is shown: the role matrix, and the four-eyes rule (the author of a
 * request may never review or issue it, even as a storekeeper or admin). Hiding a button
 * here is UX only — the API enforces the same rule inside the database transaction.
 *
 * Issuance carries an idempotency key that survives retries of the same attempt and is
 * dropped once the server answers definitively, so a timed-out call can be repeated
 * without double-deducting stock.
 */
export function RequestActions({
  request,
  products,
}: {
  request: StockRequest;
  products?: Map<string, Product>;
}) {
  const { user } = useSession();
  const can = useCan();
  const { modal, message } = App.useApp();

  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const cancel = useCancelRequest();
  const issue = useIssueRequest();

  const [shortages, setShortages] = useState<StockShortage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const isOwnRequest = request.requesterId === user.id;
  const reviewable = canReviewRequest(user.role, { requesterId: request.requesterId }, user.id);
  const issuable = canIssueRequest(user.role, { requesterId: request.requesterId }, user.id);
  const cancellable = can('request:cancel') && (can('request:read:any') || isOwnRequest);

  const busy = approve.isPending || reject.isPending || cancel.isPending || issue.isPending;

  function handleError(cause: unknown): void {
    const code = cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR';
    message.error(messageForCode(code));
  }

  async function runIssue(): Promise<void> {
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }
    const key = idempotencyKey.current;

    setShortages([]);
    setNotice(null);

    try {
      const result = await issue.mutateAsync({ id: request.id, idempotencyKey: key });
      idempotencyKey.current = null;
      if (result.idempotentReplay) {
        setNotice('This request was already issued — the original result was replayed.');
      } else {
        message.success(`Issued ${result.movementsCount} line(s)`);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INSUFFICIENT_STOCK') {
        // Nothing was written, so the key stays valid for the next attempt.
        setShortages(toShortages(cause.details));
        return;
      }
      if (cause instanceof ApiError && cause.status < 500) {
        idempotencyKey.current = null;
      }
      handleError(cause);
    }
  }

  function confirmApprove(): void {
    modal.confirm({
      title: `Approve ${request.requestNumber}?`,
      content:
        'Approval records the review decision only. Stock is not deducted until the request is issued.',
      okText: 'Approve',
      onOk: async () => {
        try {
          await approve.mutateAsync(request.id);
          message.success('Request approved');
        } catch (cause) {
          handleError(cause);
        }
      },
    });
  }

  function confirmReject(): void {
    let reason = '';
    modal.confirm({
      title: `Reject ${request.requestNumber}?`,
      content: (
        <>
          <Typography.Paragraph>Rejection is final for this request.</Typography.Paragraph>
          <Input.TextArea
            rows={3}
            maxLength={1000}
            placeholder="Reason (optional, shown to the requester)"
            onChange={(event) => {
              reason = event.target.value;
            }}
          />
        </>
      ),
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await reject.mutateAsync({ id: request.id, reason });
          message.success('Request rejected');
        } catch (cause) {
          handleError(cause);
        }
      },
    });
  }

  function confirmCancel(): void {
    let reason = '';
    modal.confirm({
      title: `Cancel ${request.requestNumber}?`,
      content: (
        <>
          <Typography.Paragraph>No stock is affected by a cancellation.</Typography.Paragraph>
          <Input.TextArea
            rows={3}
            maxLength={1000}
            placeholder="Reason (optional)"
            onChange={(event) => {
              reason = event.target.value;
            }}
          />
        </>
      ),
      okText: 'Cancel request',
      okButtonProps: { danger: true },
      cancelText: 'Keep it',
      onOk: async () => {
        try {
          await cancel.mutateAsync({ id: request.id, reason });
          message.success('Request cancelled');
        } catch (cause) {
          handleError(cause);
        }
      },
    });
  }

  function confirmIssue(): void {
    modal.confirm({
      title: `Issue ${request.requestNumber}?`,
      content: (
        <>
          <Typography.Paragraph>
            Every line is deducted from stock in a single transaction. This cannot be undone.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            If any line is short, nothing is deducted at all.
          </Typography.Paragraph>
        </>
      ),
      okText: 'Issue stock',
      onOk: runIssue,
    });
  }

  const showsFourEyesHint =
    (request.status === 'PENDING' && !reviewable && can('request:approve')) ||
    (request.status === 'APPROVED' && !issuable && can('request:issue'));

  return (
    <Flex vertical gap={12}>
      {notice && <Alert type="info" showIcon message={notice} />}
      {shortages.length > 0 && <ShortageAlert shortages={shortages} products={products} />}

      <Space wrap>
        {request.status === 'PENDING' && reviewable && (
          <>
            <Button
              type="primary"
              loading={approve.isPending}
              disabled={busy}
              onClick={confirmApprove}
            >
              Approve
            </Button>
            <Button danger loading={reject.isPending} disabled={busy} onClick={confirmReject}>
              Reject
            </Button>
          </>
        )}

        {request.status === 'APPROVED' && issuable && (
          <Button
            type="primary"
            loading={issue.isPending}
            disabled={busy}
            onClick={confirmIssue}
          >
            Issue stock
          </Button>
        )}

        {(request.status === 'PENDING' || request.status === 'APPROVED') && cancellable && (
          <Button loading={cancel.isPending} disabled={busy} onClick={confirmCancel}>
            Cancel request
          </Button>
        )}

        {(request.status === 'ISSUED' ||
          request.status === 'REJECTED' ||
          request.status === 'CANCELLED') && (
          <Typography.Text type="secondary">
            This request is closed; no further actions are available.
          </Typography.Text>
        )}
      </Space>

      {showsFourEyesHint && (
        <Typography.Text type="secondary">
          You cannot review or issue a request you created yourself (four-eyes rule).
        </Typography.Text>
      )}
    </Flex>
  );
}
