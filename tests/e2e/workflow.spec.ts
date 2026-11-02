import { expect, test } from '@playwright/test';

import { hasCredentials, signIn } from './helpers';

/**
 * Browser-level workflow for the product screens.
 *
 * Creates and deactivates a real product (SKU prefix `E2E-UI-`), so it must run against a
 * dev/test database. The API-level behaviour is covered by `npm run smoke:auth`.
 */

test.describe('products', () => {
  test.skip(!hasCredentials, 'E2E_USER and E2E_PASS must be set');

  test('create, edit and deactivate a product', async ({ page }) => {
    const sku = `E2E-UI-${Date.now()}`;
    const name = 'E2E UI product';

    await signIn(page);

    // Create
    await page.goto('/products');
    await page.getByRole('button', { name: 'New product' }).click();
    await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible();

    await page.getByLabel('SKU').fill(sku);
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Minimum stock').fill('3');
    await page.getByRole('button', { name: 'Create product' }).click();

    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText(sku).first()).toBeVisible();

    // Edit — the SKU must be read-only, because the API update contract has no SKU field.
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('SKU')).toBeDisabled();
    await page.getByLabel('Name').fill(`${name} (edited)`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: `${name} (edited)` })).toBeVisible();

    // Deactivate — irreversible, so it confirms first.
    await page.getByRole('button', { name: 'Deactivate' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('cannot be undone', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Deactivate' }).click();

    await expect(page.getByText('This product is inactive')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  });

  test('the list filters by active state and keeps state in the URL', async ({ page }) => {
    await signIn(page);
    await page.goto('/products');

    // antd Segmented renders the label as the clickable element.
    await page.getByText('Inactive', { exact: true }).click();
    await expect(page).toHaveURL(/is_active=false/);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/is_active=false/);
  });
});

test.describe('navigation', () => {
  test.skip(!hasCredentials, 'E2E_USER and E2E_PASS must be set');

  test('reports, requests and the role-gated entries render', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stock requests' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inventory report' })).toBeVisible();

    await page.goto('/reports/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory report' })).toBeVisible();

    await page.goto('/reports/requests');
    await expect(page.getByRole('heading', { name: 'Request report' })).toBeVisible();

    await page.goto('/stock-requests');
    await expect(page.getByRole('heading', { name: 'Stock requests' })).toBeVisible();
  });
});
