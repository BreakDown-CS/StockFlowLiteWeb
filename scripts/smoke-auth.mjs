#!/usr/bin/env node
/**
 * BFF authentication smoke test.
 *
 * Verifies the security-critical contract against a RUNNING server (dev or prod build)
 * and a RUNNING Go API:
 *
 *   1. unauthenticated access is rejected;
 *   2. login issues httpOnly cookies and never leaks the API token;
 *   3. the session cookie carries SameSite=Lax;
 *   4. an authenticated request is forwarded with the token server-side only;
 *   5. mutations without the CSRF header / from a foreign origin are rejected;
 *   6. logout revokes the session at the API (a replayed cookie stops working).
 *
 * Usage (Windows cmd):
 *   set INT_USER=admin & set INT_PASS=... & npm run smoke:auth
 * PowerShell:
 *   $env:INT_USER="admin"; $env:INT_PASS="..."; npm run smoke:auth
 *
 * Optional: INT_BASE (default http://localhost:3000).
 * Dependency-free, and it never prints the password.
 */

const BASE = process.env.INT_BASE ?? 'http://localhost:3000';
const USERNAME = process.env.INT_USER ?? '';
const PASSWORD = process.env.INT_PASS ?? '';

if (!USERNAME || !PASSWORD) {
  console.error('INT_USER and INT_PASS must be set.');
  process.exit(2);
}

const results = [];

function check(name, expected, actual, ok) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      expected: ${expected}`);
  console.log(`      got:      ${actual}`);
}

/** Minimal cookie store: Node's fetch does not manage cookies for us. */
const jar = new Map();

function storeCookies(response) {
  const setCookies =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];

  for (const raw of setCookies) {
    const [pair, ...attributes] = raw.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;

    const lower = attributes.map((attribute) => attribute.toLowerCase());
    jar.set(pair.slice(0, separator), {
      value: pair.slice(separator + 1),
      httpOnly: lower.includes('httponly'),
      secure: lower.includes('secure'),
      sameSite: lower.find((attribute) => attribute.startsWith('samesite=')) ?? '',
      expired: pair.slice(separator + 1) === '' || lower.includes('max-age=0'),
    });
  }
}

function cookieHeader() {
  return [...jar.entries()]
    .filter(([, cookie]) => !cookie.expired)
    .map(([name, cookie]) => `${name}=${cookie.value}`)
    .join('; ');
}

async function call(method, path, { body, headers = {} } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  const cookies = cookieHeader();
  if (cookies) {
    requestHeaders.Cookie = cookies;
  }

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

function findBySuffix(suffix) {
  for (const [name, cookie] of jar.entries()) {
    if (name.endsWith(suffix)) return { name, ...cookie };
  }
  return undefined;
}

async function main() {
  console.log(`Target: ${BASE}`);
  console.log(`User:   ${USERNAME}\n`);

  // 1. no session yet
  const anonymous = await call('GET', '/api/bff/auth/me');
  check(
    'me without a session',
    '401 + BFF_NO_SESSION',
    `${anonymous.status} ${anonymous.text}`,
    anonymous.status === 401 && anonymous.json?.error?.code === 'BFF_NO_SESSION',
  );

  // 2. login
  const login = await call('POST', '/api/bff/auth/login', {
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    body: { username: USERNAME, password: PASSWORD },
  });

  check(
    'login succeeds',
    '200 + success:true',
    `${login.status} ${login.text}`,
    login.status === 200 && login.json?.success === true,
  );

  check(
    'response never contains the API token',
    'no "token" property',
    login.text.includes('"token"') ? 'TOKEN LEAKED' : 'no token in body',
    !login.text.includes('"token"'),
  );

  const session = findBySuffix('session');
  const csrf = findBySuffix('csrf');

  check(
    'session cookie is HttpOnly',
    'HttpOnly present',
    session ? String(session.httpOnly) : 'missing',
    Boolean(session?.httpOnly),
  );

  check(
    'session cookie is SameSite=Lax',
    'samesite=lax',
    session?.sameSite || 'missing',
    (session?.sameSite ?? '').replace(/\s/g, '') === 'samesite=lax',
  );

  check(
    'csrf cookie is readable by the client',
    'HttpOnly absent',
    csrf ? String(csrf.httpOnly) : 'missing',
    Boolean(csrf) && csrf.httpOnly === false,
  );

  // 3. authenticated read is forwarded server-side
  const me = await call('GET', '/api/bff/auth/me');
  check(
    'me with a session',
    '200 + user + expires_at',
    `${me.status} ${me.text}`,
    me.status === 200 && Boolean(me.json?.data?.user) && Boolean(me.json?.data?.expires_at),
  );

  // 4. dashboard data paths (Phase F2)
  const summary = await call('GET', '/api/bff/reports/inventory?is_active=all&limit=1');
  const summaryKeys = summary.json?.data?.summary
    ? Object.keys(summary.json.data.summary).sort().join(',')
    : 'missing';
  check(
    'inventory summary (unfiltered)',
    '200 + five summary counters',
    `${summary.status} counters=${summaryKeys}`,
    summary.status === 200 &&
      summaryKeys ===
        'active_products,inactive_products,low_stock_products,out_of_stock_products,total_products',
  );

  const lowStock = await call('GET', '/api/bff/reports/inventory?low_stock=true&limit=8');
  check(
    'low stock page',
    '200 + items[] + meta.total',
    `${lowStock.status} items=${Array.isArray(lowStock.json?.data?.items) ? lowStock.json.data.items.length : 'n/a'} total=${lowStock.json?.meta?.total}`,
    lowStock.status === 200 && Array.isArray(lowStock.json?.data?.items) && lowStock.json?.meta?.total !== undefined,
  );

  const oversized = await call('GET', '/api/bff/reports/inventory?limit=500');
  check(
    'query allowlist rejects limit > 100',
    '400 + VALIDATION_ERROR',
    `${oversized.status} ${oversized.text}`,
    oversized.status === 400 && oversized.json?.error?.code === 'VALIDATION_ERROR',
  );

  const dashboard = await call('GET', '/');
  check(
    'dashboard page renders with a session',
    '200 + Dashboard',
    `${dashboard.status}`,
    dashboard.status === 200 && dashboard.text.includes('Dashboard'),
  );

  // ADMIN holds receipt:create, so the sidebar must render that entry.
  check(
    'sidebar renders role-gated navigation',
    '200 + nav labels for ADMIN',
    `hasReceiveStock=${dashboard.text.includes('Receive stock')} hasRequests=${dashboard.text.includes('Stock requests')}`,
    dashboard.text.includes('Receive stock') && dashboard.text.includes('Stock requests'),
  );

  // 5. products (Phase F3) — read paths run always, writes are opt-in
  const productList = await call('GET', '/api/bff/products?limit=20');
  check(
    'product list',
    '200 + array + meta.total',
    `${productList.status} rows=${Array.isArray(productList.json?.data) ? productList.json.data.length : 'n/a'} total=${productList.json?.meta?.total}`,
    productList.status === 200 &&
      Array.isArray(productList.json?.data) &&
      productList.json?.meta?.total !== undefined,
  );

  const productOversize = await call('GET', '/api/bff/products?limit=500');
  check(
    'products: limit > 100 rejected',
    '400 + VALIDATION_ERROR',
    `${productOversize.status} ${productOversize.text}`,
    productOversize.status === 400 && productOversize.json?.error?.code === 'VALIDATION_ERROR',
  );

  const badId = await call('GET', '/api/bff/products/not-a-uuid');
  check(
    'products: malformed id rejected before upstream',
    '400 + INVALID_ID',
    `${badId.status} ${badId.text}`,
    badId.status === 400 && badId.json?.error?.code === 'INVALID_ID',
  );

  const productsPage = await call('GET', '/products');
  check(
    'products page renders',
    '200 + Products',
    `${productsPage.status}`,
    productsPage.status === 200 && productsPage.text.includes('Products'),
  );

  if (process.env.INT_ALLOW_WRITES === '1') {
    const writeHeaders = {
      Origin: BASE,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf?.value ?? '',
    };
    const sku = `E2E-F3-${Date.now()}`;

    const created = await call('POST', '/api/bff/products', {
      headers: writeHeaders,
      body: { sku, name: 'Smoke test product', unit: 'BOX', min_stock: 2 },
    });
    const productId = created.json?.data?.id;
    check(
      'create product',
      '201 + id',
      `${created.status} id=${productId}`,
      created.status === 201 && typeof productId === 'string',
    );

    const duplicate = await call('POST', '/api/bff/products', {
      headers: writeHeaders,
      body: { sku, name: 'Duplicate SKU attempt', unit: 'BOX' },
    });
    check(
      'duplicate SKU rejected by the API',
      '409 + DUPLICATE_SKU',
      `${duplicate.status} ${duplicate.text}`,
      duplicate.status === 409 && duplicate.json?.error?.code === 'DUPLICATE_SKU',
    );

    const createdWithoutCsrf = await call('POST', '/api/bff/products', {
      headers: { Origin: BASE, 'Content-Type': 'application/json' },
      body: { sku: `${sku}-NOCSRF`, name: 'No CSRF' },
    });
    check(
      'create without CSRF blocked',
      '403 + BFF_CSRF_FAILED',
      `${createdWithoutCsrf.status} ${createdWithoutCsrf.text}`,
      createdWithoutCsrf.status === 403,
    );

    const detail = await call('GET', `/api/bff/products/${productId}`);
    check(
      'read the created product',
      '200 + matching sku',
      `${detail.status} sku=${detail.json?.data?.sku}`,
      detail.status === 200 && detail.json?.data?.sku === sku,
    );

    const updated = await call('PUT', `/api/bff/products/${productId}`, {
      headers: writeHeaders,
      body: {
        name: 'Smoke test product (edited)',
        description: 'edited by the smoke test',
        unit: 'BOX',
        min_stock: 7,
      },
    });
    check(
      'update product',
      '200 + new name and min_stock',
      `${updated.status} name=${updated.json?.data?.name} min=${updated.json?.data?.min_stock}`,
      updated.status === 200 &&
        updated.json?.data?.name === 'Smoke test product (edited)' &&
        updated.json?.data?.min_stock === 7,
    );

    const deactivated = await call('PATCH', `/api/bff/products/${productId}/deactivate`, {
      headers: writeHeaders,
    });
    check(
      'deactivate product',
      '200',
      `${deactivated.status} ${deactivated.text}`,
      deactivated.status === 200,
    );

    const afterDeactivate = await call('GET', `/api/bff/products/${productId}`);
    check(
      'product is inactive afterwards',
      'is_active=false',
      `is_active=${afterDeactivate.json?.data?.is_active}`,
      afterDeactivate.json?.data?.is_active === false,
    );

    const inactiveList = await call(
      'GET',
      `/api/bff/products?is_active=false&search=${encodeURIComponent(sku)}`,
    );
    const found =
      Array.isArray(inactiveList.json?.data) &&
      inactiveList.json.data.some((item) => item.sku === sku);
    check('inactive filter finds the product', 'present in list', `found=${found}`, found);
  } else {
    console.log('SKIP  product write flow (set INT_ALLOW_WRITES=1 to run it)');
  }

  // 6. movements ledger (Phase F4)
  const ledger = await call('GET', '/api/bff/reports/stock-movements?limit=5');
  const ledgerSummaryKeys = ledger.json?.data?.summary
    ? Object.keys(ledger.json.data.summary).sort().join(',')
    : 'missing';
  check(
    'movement ledger',
    '200 + items[] + complete summary',
    `${ledger.status} rows=${Array.isArray(ledger.json?.data?.items) ? ledger.json.data.items.length : 'n/a'} summary=${ledgerSummaryKeys}`,
    ledger.status === 200 &&
      Array.isArray(ledger.json?.data?.items) &&
      ledgerSummaryKeys ===
        'adjustment_total_quantity,issue_total_quantity,movement_count,net_change,receipt_total_quantity',
  );

  const inverted = await call(
    'GET',
    `/api/bff/reports/stock-movements?from=${encodeURIComponent('2026-10-29T00:00:00Z')}&to=${encodeURIComponent('2026-10-01T00:00:00Z')}`,
  );
  check(
    'inverted date range rejected before upstream',
    '400 + VALIDATION_ERROR',
    `${inverted.status} ${inverted.text}`,
    inverted.status === 400 && inverted.json?.error?.code === 'VALIDATION_ERROR',
  );

  const movementsPage = await call('GET', '/stock-movements');
  check(
    'movements page renders',
    '200 + Stock movements',
    `${movementsPage.status}`,
    movementsPage.status === 200 && movementsPage.text.includes('Stock movements'),
  );

  if (process.env.INT_ALLOW_WRITES === '1') {
    const receiptHeaders = {
      Origin: BASE,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf?.value ?? '',
    };
    const receiptSku = `E2E-F4-${Date.now()}`;

    const setup = await call('POST', '/api/bff/products', {
      headers: receiptHeaders,
      body: { sku: receiptSku, name: 'Receipt smoke product', unit: 'BOX' },
    });
    const receiptProductId = setup.json?.data?.id;
    check(
      'receipt setup: product created',
      '201 + id',
      `${setup.status} id=${receiptProductId}`,
      setup.status === 201 && typeof receiptProductId === 'string',
    );

    const firstReceipt = await call('POST', '/api/bff/stock-receipts', {
      headers: receiptHeaders,
      body: { product_id: receiptProductId, quantity: 5, notes: 'smoke receipt 1' },
    });
    check(
      'receive stock',
      '201 + stock 5 + movement id',
      `${firstReceipt.status} stock=${firstReceipt.json?.data?.product?.current_stock} movement=${firstReceipt.json?.data?.movement?.id}`,
      firstReceipt.status === 201 &&
        firstReceipt.json?.data?.product?.current_stock === 5 &&
        typeof firstReceipt.json?.data?.movement?.id === 'number',
    );

    const secondReceipt = await call('POST', '/api/bff/stock-receipts', {
      headers: receiptHeaders,
      body: { product_id: receiptProductId, quantity: 7 },
    });
    check(
      'second receipt accumulates',
      '201 + stock 12',
      `${secondReceipt.status} stock=${secondReceipt.json?.data?.product?.current_stock}`,
      secondReceipt.status === 201 && secondReceipt.json?.data?.product?.current_stock === 12,
    );

    const zeroQuantity = await call('POST', '/api/bff/stock-receipts', {
      headers: receiptHeaders,
      body: { product_id: receiptProductId, quantity: 0 },
    });
    check(
      'quantity 0 rejected by the BFF',
      '400 + VALIDATION_ERROR',
      `${zeroQuantity.status} ${zeroQuantity.text}`,
      zeroQuantity.status === 400 && zeroQuantity.json?.error?.code === 'VALIDATION_ERROR',
    );

    const ledgerForProduct = await call(
      'GET',
      `/api/bff/reports/stock-movements?product_id=${receiptProductId}&limit=10`,
    );
    const receiptRows = (ledgerForProduct.json?.data?.items ?? []).filter(
      (movement) => movement.movement_type === 'RECEIPT',
    );
    const signedSum = receiptRows.reduce((total, movement) => total + movement.signed_quantity, 0);
    check(
      'ledger lists both receipts with a positive signed quantity',
      '2 rows, signed sum 12',
      `rows=${receiptRows.length} sum=${signedSum}`,
      ledgerForProduct.status === 200 && receiptRows.length === 2 && signedSum === 12,
    );

    await call('PATCH', `/api/bff/products/${receiptProductId}/deactivate`, {
      headers: receiptHeaders,
    });
    const receiptOnInactive = await call('POST', '/api/bff/stock-receipts', {
      headers: receiptHeaders,
      body: { product_id: receiptProductId, quantity: 1 },
    });
    check(
      'receipt on an inactive product is rejected',
      '400 + PRODUCT_INACTIVE',
      `${receiptOnInactive.status} ${receiptOnInactive.text}`,
      receiptOnInactive.status === 400 &&
        receiptOnInactive.json?.error?.code === 'PRODUCT_INACTIVE',
    );
  } else {
    console.log('SKIP  receipt write flow (set INT_ALLOW_WRITES=1 to run it)');
  }

  // 7. stock requests (Phase F5) — read paths always, workflow is opt-in
  const requestsList = await call('GET', '/api/bff/stock-requests?limit=5');
  check(
    'request list',
    '200 + array + meta.total',
    `${requestsList.status} rows=${Array.isArray(requestsList.json?.data) ? requestsList.json.data.length : 'n/a'} total=${requestsList.json?.meta?.total}`,
    requestsList.status === 200 &&
      Array.isArray(requestsList.json?.data) &&
      requestsList.json?.meta?.total !== undefined,
  );

  const badStatus = await call('GET', '/api/bff/stock-requests?status=NOPE');
  check(
    'unknown status rejected',
    '400 + VALIDATION_ERROR',
    `${badStatus.status} ${badStatus.text}`,
    badStatus.status === 400 && badStatus.json?.error?.code === 'VALIDATION_ERROR',
  );

  const badRequestId = await call('GET', '/api/bff/stock-requests/not-a-uuid');
  check(
    'malformed request id rejected',
    '400 + INVALID_ID',
    `${badRequestId.status} ${badRequestId.text}`,
    badRequestId.status === 400 && badRequestId.json?.error?.code === 'INVALID_ID',
  );

  const unknownAction = await call(
    'POST',
    `/api/bff/stock-requests/${'11111111-1111-4111-8111-111111111111'}/frobnicate`,
    { headers: { Origin: BASE, 'X-CSRF-Token': csrf?.value ?? '' } },
  );
  check(
    'unknown workflow action refused by the BFF',
    '404 + BFF_ROUTE_NOT_ALLOWED',
    `${unknownAction.status} ${unknownAction.text}`,
    unknownAction.status === 404 && unknownAction.json?.error?.code === 'BFF_ROUTE_NOT_ALLOWED',
  );

  const badKey = await call(
    'POST',
    `/api/bff/stock-requests/${'11111111-1111-4111-8111-111111111111'}/issue`,
    { headers: { Origin: BASE, 'X-CSRF-Token': csrf?.value ?? '', 'Idempotency-Key': 'short' } },
  );
  check(
    'invalid idempotency key rejected',
    '400 + INVALID_IDEMPOTENCY_KEY',
    `${badKey.status} ${badKey.text}`,
    badKey.status === 400 && badKey.json?.error?.code === 'INVALID_IDEMPOTENCY_KEY',
  );

  const requestsPage = await call('GET', '/stock-requests');
  check(
    'requests page renders',
    '200 + Stock requests',
    `${requestsPage.status}`,
    requestsPage.status === 200 && requestsPage.text.includes('Stock requests'),
  );

  if (process.env.INT_ALLOW_WRITES === '1') {
    const reqHeaders = {
      Origin: BASE,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf?.value ?? '',
    };
    const requestSku = `E2E-F5-${Date.now()}`;

    const productSetup = await call('POST', '/api/bff/products', {
      headers: reqHeaders,
      body: { sku: requestSku, name: 'Request smoke product', unit: 'BOX' },
    });
    const requestProductId = productSetup.json?.data?.id;

    await call('POST', '/api/bff/stock-receipts', {
      headers: reqHeaders,
      body: { product_id: requestProductId, quantity: 10, notes: 'request smoke setup' },
    });

    const createdRequest = await call('POST', '/api/bff/stock-requests', {
      headers: reqHeaders,
      body: {
        items: [{ product_id: requestProductId, quantity: 3 }],
        notes: 'smoke request',
      },
    });
    const requestId = createdRequest.json?.data?.id;
    check(
      'create request',
      '201 + PENDING',
      `${createdRequest.status} id=${requestId} status=${createdRequest.json?.data?.status}`,
      createdRequest.status === 201 && createdRequest.json?.data?.status === 'PENDING',
    );

    const selfApprove = await call('POST', `/api/bff/stock-requests/${requestId}/approve`, {
      headers: reqHeaders,
    });
    check(
      'four-eyes: author cannot approve their own request',
      '403 + SELF_APPROVAL_FORBIDDEN',
      `${selfApprove.status} ${selfApprove.text}`,
      selfApprove.status === 403 &&
        selfApprove.json?.error?.code === 'SELF_APPROVAL_FORBIDDEN',
    );

    const selfIssue = await call('POST', `/api/bff/stock-requests/${requestId}/issue`, {
      headers: { ...reqHeaders, 'Idempotency-Key': `smoke-${Date.now()}` },
    });
    check(
      'four-eyes: author cannot issue their own request either',
      '403 + SELF_APPROVAL_FORBIDDEN',
      `${selfIssue.status} ${selfIssue.text}`,
      selfIssue.status === 403 && selfIssue.json?.error?.code === 'SELF_APPROVAL_FORBIDDEN',
    );

    const cancelled = await call('POST', `/api/bff/stock-requests/${requestId}/cancel`, {
      headers: reqHeaders,
      body: { reason: 'smoke test cleanup' },
    });
    check(
      'author can cancel their own pending request',
      '200 + CANCELLED',
      `${cancelled.status} status=${cancelled.json?.data?.status}`,
      cancelled.status === 200 && cancelled.json?.data?.status === 'CANCELLED',
    );
  } else {
    console.log('SKIP  request workflow flow (set INT_ALLOW_WRITES=1 to run it)');
  }

  // 8. reports (Phase F6)
  const requestReport = await call('GET', '/api/bff/reports/stock-requests?limit=5');
  const reportSummaryKeys = requestReport.json?.data?.summary
    ? Object.keys(requestReport.json.data.summary).sort().join(',')
    : 'missing';
  check(
    'request report',
    '200 + items[] + summary',
    `${requestReport.status} summary=${reportSummaryKeys}`,
    requestReport.status === 200 &&
      Array.isArray(requestReport.json?.data?.items) &&
      reportSummaryKeys ===
        'approved_requests,cancelled_requests,issued_requests,issued_units_total,pending_requests,rejected_requests,requested_units_total,total_requests',
  );

  const invertedReport = await call(
    'GET',
    `/api/bff/reports/stock-requests?from=${encodeURIComponent('2026-10-29T00:00:00Z')}&to=${encodeURIComponent('2026-10-01T00:00:00Z')}`,
  );
  check(
    'request report rejects an inverted range',
    '400 + VALIDATION_ERROR',
    `${invertedReport.status} ${invertedReport.text}`,
    invertedReport.status === 400 && invertedReport.json?.error?.code === 'VALIDATION_ERROR',
  );

  const inventoryPage = await call('GET', '/reports/inventory');
  check(
    'inventory report page renders',
    '200 + Inventory report',
    `${inventoryPage.status}`,
    inventoryPage.status === 200 && inventoryPage.text.includes('Inventory report'),
  );

  const requestReportPage = await call('GET', '/reports/requests');
  check(
    'request report page renders',
    '200 + Request report',
    `${requestReportPage.status}`,
    requestReportPage.status === 200 && requestReportPage.text.includes('Request report'),
  );

  // The movement report redirects to the ledger with a 30-day window.
  const movementReport = await call('GET', '/reports/movements');
  check(
    'movement report redirects to the ledger with a window',
    '307 + /stock-movements?from=',
    `${movementReport.status} ${movementReport.text.slice(0, 80)}`,
    movementReport.status >= 300 &&
      movementReport.status < 400 &&
      movementReport.text.includes('stock-movements'),
  );

  // Deliberately uses a wrong current password: this must fail without changing anything.
  const wrongPassword = await call('POST', '/api/bff/auth/change-password', {
    headers: {
      Origin: BASE,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf?.value ?? '',
    },
    body: { current_password: 'definitely-not-the-password', new_password: 'irrelevant-123' },
  });
  check(
    'change password with a wrong current password is refused',
    '401 + INVALID_CREDENTIALS',
    `${wrongPassword.status} ${wrongPassword.text}`,
    wrongPassword.status === 401 &&
      wrongPassword.json?.error?.code === 'INVALID_CREDENTIALS',
  );

  // 9. mutation without the CSRF header
  const noCsrf = await call('POST', '/api/bff/auth/logout', { headers: { Origin: BASE } });
  check(
    'logout without X-CSRF-Token',
    '403 + BFF_CSRF_FAILED',
    `${noCsrf.status} ${noCsrf.text}`,
    noCsrf.status === 403 && noCsrf.json?.error?.code === 'BFF_CSRF_FAILED',
  );

  // 5. mutation from a foreign origin
  const badOrigin = await call('POST', '/api/bff/auth/logout', {
    headers: { Origin: 'https://evil.example', 'X-CSRF-Token': csrf?.value ?? '' },
  });
  check(
    'logout from a foreign origin',
    '403 + BFF_CSRF_FAILED',
    `${badOrigin.status} ${badOrigin.text}`,
    badOrigin.status === 403 && badOrigin.json?.error?.code === 'BFF_CSRF_FAILED',
  );

  const replayedCookie = cookieHeader();

  const logout = await call('POST', '/api/bff/auth/logout', {
    headers: { Origin: BASE, 'X-CSRF-Token': csrf?.value ?? '' },
  });
  check(
    'logout with a valid origin and token',
    '200',
    `${logout.status} ${logout.text}`,
    logout.status === 200,
  );

  const cleared = findBySuffix('session');
  check(
    'logout clears the session cookie',
    'empty value / Max-Age=0',
    String(cleared?.expired),
    Boolean(cleared?.expired),
  );

  // 6. replay the pre-logout cookie: the API session must be gone
  const replay = await fetch(`${BASE}/api/bff/auth/me`, {
    headers: { Accept: 'application/json', Cookie: replayedCookie },
    redirect: 'manual',
  });
  const replayText = await replay.text();
  check(
    'replayed cookie rejected (session revoked upstream)',
    '401 + BFF_SESSION_EXPIRED',
    `${replay.status} ${replayText}`,
    replay.status === 401 && replayText.includes('BFF_SESSION_EXPIRED'),
  );

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
