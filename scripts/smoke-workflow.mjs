#!/usr/bin/env node
/**
 * Two-account workflow smoke test.
 *
 * Exercises the parts of the stock-request workflow that need two different people:
 *
 *   1. a reviewer creates a product and receives stock;
 *   2. a requester submits a two-line request;
 *   3. the reviewer approves it;
 *   4. issuing fails with INSUFFICIENT_STOCK and per-item details (nothing deducted);
 *   5. after receiving more stock the issue succeeds;
 *   6. replaying the SAME idempotency key does not deduct a second time;
 *   7. issuing again with a NEW key is refused with INVALID_STATE;
 *   8. a second request is rejected with a reason.
 *
 * Both accounts must exist. The requester may be an ADMIN; the reviewer must be someone
 * else (the four-eyes rule forbids reviewing your own request).
 *
 * Usage (Windows cmd):
 *   set INT_USER=admin& set INT_PASS=...& set INT_REVIEWER_USER=f5_storekeeper&
 *   set INT_REVIEWER_PASS=...& npm run smoke:workflow
 */

const BASE = process.env.INT_BASE ?? 'http://localhost:3000';

const REQUESTER = { user: process.env.INT_USER ?? '', pass: process.env.INT_PASS ?? '' };
const REVIEWER = {
  user: process.env.INT_REVIEWER_USER ?? '',
  pass: process.env.INT_REVIEWER_PASS ?? '',
};

if (!REQUESTER.user || !REQUESTER.pass || !REVIEWER.user || !REVIEWER.pass) {
  console.error('INT_USER/INT_PASS and INT_REVIEWER_USER/INT_REVIEWER_PASS must be set.');
  process.exit(2);
}

const results = [];

function check(name, expected, actual, ok) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      expected: ${expected}`);
  console.log(`      got:      ${actual}`);
}

/** Minimal cookie-aware client; Node's fetch does not keep cookies for us. */
function createClient(label) {
  const jar = new Map();

  function storeCookies(response) {
    const setCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair, ...attributes] = raw.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      if (separator <= 0) continue;
      const value = pair.slice(separator + 1);
      jar.set(pair.slice(0, separator), {
        value,
        expired: value === '' || attributes.map((a) => a.toLowerCase()).includes('max-age=0'),
      });
    }
  }

  function cookieHeader() {
    return [...jar.entries()]
      .filter(([, cookie]) => !cookie.expired)
      .map(([name, cookie]) => `${name}=${cookie.value}`)
      .join('; ');
  }

  function findCookie(suffix) {
    for (const [name, cookie] of jar.entries()) {
      if (name.endsWith(suffix)) return cookie.value;
    }
    return undefined;
  }

  async function call(method, path, { body, headers = {} } = {}) {
    const requestHeaders = { Accept: 'application/json', ...headers };
    const cookies = cookieHeader();
    if (cookies) requestHeaders.Cookie = cookies;

    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    storeCookies(response);

    const text = await response.text();
    let json;
    try {
      json = text.length > 0 ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: response.status, text, json };
  }

  async function login() {
    const credentials = label === 'reviewer' ? REVIEWER : REQUESTER;
    const response = await call('POST', '/api/bff/auth/login', {
      headers: { Origin: BASE, 'Content-Type': 'application/json' },
      body: { username: credentials.user, password: credentials.pass },
    });
    return response;
  }

  /** Mutating helper: adds the CSRF header from the readable cookie. */
  async function mutate(method, path, body, extraHeaders = {}) {
    const csrf = findCookie('csrf') ?? '';
    return call(method, path, {
      headers: {
        Origin: BASE,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        ...extraHeaders,
      },
      body,
    });
  }

  return { call, login, mutate };
}

async function main() {
  console.log(`Target:    ${BASE}`);
  console.log(`Requester: ${REQUESTER.user}`);
  console.log(`Reviewer:  ${REVIEWER.user}\n`);

  const reviewer = createClient('reviewer');
  const requester = createClient('requester');

  const reviewerLogin = await reviewer.login();
  check('reviewer signs in', '200', `${reviewerLogin.status}`, reviewerLogin.status === 200);

  const requesterLogin = await requester.login();
  check('requester signs in', '200', `${requesterLogin.status}`, requesterLogin.status === 200);

  const stamp = Date.now();
  const skuA = `E2E-WF-A-${stamp}`;
  const skuB = `E2E-WF-B-${stamp}`;

  const productA = await reviewer.mutate('POST', '/api/bff/products', {
    sku: skuA,
    name: 'Workflow product A',
    unit: 'BOX',
  });
  const productAId = productA.json?.data?.id;

  const productB = await reviewer.mutate('POST', '/api/bff/products', {
    sku: skuB,
    name: 'Workflow product B',
    unit: 'BOX',
  });
  const productBId = productB.json?.data?.id;

  check(
    'reviewer creates two products',
    'both 201',
    `${productA.status}/${productB.status}`,
    productA.status === 201 && productB.status === 201,
  );

  await reviewer.mutate('POST', '/api/bff/stock-receipts', {
    product_id: productAId,
    quantity: 10,
  });

  const created = await requester.mutate('POST', '/api/bff/stock-requests', {
    items: [
      { product_id: productAId, quantity: 3 },
      { product_id: productBId, quantity: 2 },
    ],
    notes: 'workflow smoke',
  });
  const requestId = created.json?.data?.id;
  check(
    'requester submits a two-line request',
    '201 + PENDING',
    `${created.status} status=${created.json?.data?.status}`,
    created.status === 201 && created.json?.data?.status === 'PENDING',
  );

  const approved = await reviewer.mutate('POST', `/api/bff/stock-requests/${requestId}/approve`);
  check(
    'a different user can approve it',
    '200 + APPROVED',
    `${approved.status} status=${approved.json?.data?.status}`,
    approved.status === 200 && approved.json?.data?.status === 'APPROVED',
  );

  const shortIssue = await reviewer.mutate(
    'POST',
    `/api/bff/stock-requests/${requestId}/issue`,
    undefined,
    { 'Idempotency-Key': `wf-short-${stamp}` },
  );
  const shortages = shortIssue.json?.error?.details?.items ?? [];
  check(
    'issuing with a short line is refused with per-item details',
    '409 INSUFFICIENT_STOCK + 1 short item',
    `${shortIssue.status} code=${shortIssue.json?.error?.code} items=${shortages.length}`,
    shortIssue.status === 409 &&
      shortIssue.json?.error?.code === 'INSUFFICIENT_STOCK' &&
      shortages.length === 1 &&
      shortages[0]?.product_id === productBId,
  );

  const afterShort = await reviewer.call('GET', `/api/bff/products/${productAId}`);
  check(
    'nothing was deducted by the failed issue',
    'product A still 10',
    `stock=${afterShort.json?.data?.current_stock}`,
    afterShort.json?.data?.current_stock === 10,
  );

  await reviewer.mutate('POST', '/api/bff/stock-receipts', {
    product_id: productBId,
    quantity: 5,
  });

  const issueKey = `wf-issue-${stamp}`;
  const issued = await reviewer.mutate(
    'POST',
    `/api/bff/stock-requests/${requestId}/issue`,
    undefined,
    { 'Idempotency-Key': issueKey },
  );
  check(
    'issue succeeds once stock is available',
    '200 + ISSUED',
    `${issued.status} status=${issued.json?.data?.request?.status}`,
    issued.status === 200 && issued.json?.data?.request?.status === 'ISSUED',
  );

  const stockAfterIssue = await reviewer.call('GET', `/api/bff/products/${productAId}`);
  const stockBAfterIssue = await reviewer.call('GET', `/api/bff/products/${productBId}`);
  check(
    'stock was deducted exactly once',
    'A=7 B=3',
    `A=${stockAfterIssue.json?.data?.current_stock} B=${stockBAfterIssue.json?.data?.current_stock}`,
    stockAfterIssue.json?.data?.current_stock === 7 &&
      stockBAfterIssue.json?.data?.current_stock === 3,
  );

  const replay = await reviewer.mutate(
    'POST',
    `/api/bff/stock-requests/${requestId}/issue`,
    undefined,
    { 'Idempotency-Key': issueKey },
  );
  check(
    'replaying the same idempotency key is a no-op',
    '200 + idempotent_replay',
    `${replay.status} replay=${replay.json?.meta?.idempotent_replay}`,
    replay.status === 200 && replay.json?.meta?.idempotent_replay === true,
  );

  const stockAfterReplay = await reviewer.call('GET', `/api/bff/products/${productAId}`);
  check(
    'the replay did not deduct again',
    'product A still 7',
    `stock=${stockAfterReplay.json?.data?.current_stock}`,
    stockAfterReplay.json?.data?.current_stock === 7,
  );

  const secondIssue = await reviewer.mutate(
    'POST',
    `/api/bff/stock-requests/${requestId}/issue`,
    undefined,
    { 'Idempotency-Key': `wf-issue-2-${stamp}` },
  );
  check(
    'issuing an already issued request is a state conflict',
    '409 INVALID_STATE + current_status=ISSUED',
    `${secondIssue.status} code=${secondIssue.json?.error?.code} status=${secondIssue.json?.error?.details?.current_status}`,
    secondIssue.status === 409 &&
      secondIssue.json?.error?.code === 'INVALID_STATE' &&
      secondIssue.json?.error?.details?.current_status === 'ISSUED',
  );

  const secondRequest = await requester.mutate('POST', '/api/bff/stock-requests', {
    items: [{ product_id: productAId, quantity: 1 }],
    notes: 'workflow smoke reject',
  });
  const secondRequestId = secondRequest.json?.data?.id;

  const rejected = await reviewer.mutate(
    'POST',
    `/api/bff/stock-requests/${secondRequestId}/reject`,
    { rejection_reason: 'not needed this week' },
  );
  check(
    'reviewer rejects with a reason',
    '200 + REJECTED + reason stored',
    `${rejected.status} status=${rejected.json?.data?.status} reason=${rejected.json?.data?.rejection_reason}`,
    rejected.status === 200 &&
      rejected.json?.data?.status === 'REJECTED' &&
      rejected.json?.data?.rejection_reason === 'not needed this week',
  );

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} workflow checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Workflow smoke test crashed:', error);
  process.exit(1);
});
