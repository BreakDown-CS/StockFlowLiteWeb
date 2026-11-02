import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E helpers.
 *
 * The browser interaction is deliberately conservative: wait for the network to settle
 * before typing, because a click that lands before React hydrates hits a form with no
 * handler attached and silently does nothing (a classic, confusing flake).
 */

export const E2E_USER = process.env.E2E_USER ?? '';
export const E2E_PASS = process.env.E2E_PASS ?? '';

export const hasCredentials = Boolean(E2E_USER && E2E_PASS);

/** Signs in through the real form and waits until the authenticated shell is rendered. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Username').fill(E2E_USER);
  await page.getByLabel('Password').fill(E2E_PASS);

  await page.getByRole('button', { name: 'Sign in' }).click();

  // The sidebar only exists inside the authenticated shell, so its presence is proof that
  // the sign-in completed (the login page has no navigation at all).
  await expect(page.getByRole('link', { name: 'Products' })).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}
