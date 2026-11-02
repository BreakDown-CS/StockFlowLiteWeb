import { expect, test } from '@playwright/test';

import { E2E_PASS, E2E_USER, hasCredentials, signIn } from './helpers';

/**
 * Browser-level authentication.
 *
 * The API-level contract (cookie flags, CSRF, revocation) is already asserted by
 * `npm run smoke:auth`; these tests cover what only a browser can show: the redirect
 * flow, the rendered error state and the httpOnly cookie actually being set.
 */

test.describe('authentication', () => {
  test.skip(!hasCredentials, 'E2E_USER and E2E_PASS must be set');

  test('visiting an app route without a session lands on the login page', async ({ page }) => {
    await page.goto('/products');

    await expect(page).toHaveURL(/\/login\?next=%2Fproducts/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('wrong credentials show a persistent error and issue no cookie', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Username').fill(E2E_USER);
    await page.getByLabel('Password').fill(`${E2E_PASS}-definitely-wrong`);

    await expect(async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Incorrect username or password.')).toBeVisible({
        timeout: 5_000,
      });
    }).toPass({ timeout: 30_000 });

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name.includes('session'))).toBeUndefined();
  });

  test('a valid sign-in reaches the dashboard and the session cookie is httpOnly', async ({
    page,
    context,
  }) => {
    await signIn(page);

    await expect(page).toHaveURL(/\/$/);

    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name.includes('session'));
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);

    // The token must never be readable from JavaScript.
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).not.toContain('token');
  });

  test('signing out returns to the login page and the session is gone', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: new RegExp(E2E_USER) }).click();
    await page.getByText('Sign out').click();

    await expect(page).toHaveURL(/\/login/);

    // Going back must not restore an authenticated view.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});
