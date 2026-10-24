import { expect, test } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { TEST_USER_EMAIL } from '../support/env';

// Core user flow on the isolated stack (local Supabase + deterministic mock market pinned to
// Friday 2026-10-23 after the close, which yields Reversal setups for AXP and CB).
test('sign in, scan, review a setup, and log a closed trade', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // Skip the first-run product tour so it does not cover the dashboard.
  await page.addInitScript(() => localStorage.setItem('swingflow_tour_done', '1'));
  await setupClerkTestingToken({ page });

  await test.step('sign in', async () => {
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
    await page.goto('/');
    await expect(page.getByText("Today's P&L")).toBeVisible();
    await expect(page.locator('#tour-goal')).toContainText('$0');
  });

  const setups = page.locator('#tour-setups');

  await test.step('scan finds the expected setups', async () => {
    await page.getByRole('button', { name: 'Scan Now' }).click();
    // A manual scan covers ~125 symbols; the mock market generates their history on first use.
    const started = Date.now();
    await expect(page.getByText('Scan complete · 2 active setups')).toBeVisible({ timeout: 45_000 });
    test.info().annotations.push({ type: 'scan duration', description: `${Date.now() - started} ms` });
    await expect(setups.getByText('AXP', { exact: true })).toBeVisible();
    await expect(setups.getByText('CB', { exact: true })).toBeVisible();
  });

  await test.step('open the setup detail', async () => {
    await setups.getByText('AXP', { exact: true }).click();
    await expect(page).toHaveURL(/\/setup\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'AXP' })).toBeVisible();
    await page.goBack();
    await expect(setups.getByText('AXP', { exact: true })).toBeVisible();
  });

  await test.step('log the trade as closed at its target', async () => {
    await page.getByRole('button', { name: /Log trade/ }).click();
    const modal = page.locator('form').filter({ hasText: 'Exit Price' }).or(page.locator('form').filter({ hasText: 'Setup' }));
    await modal.getByRole('button', { name: /AXP/ }).click();
    await modal.getByRole('button', { name: /^Target \$/ }).click();
    await modal.getByRole('button', { name: 'Record Close' }).click();
    await expect(page.locator('#tour-goal')).not.toContainText('$0 /');
    await expect(setups.getByText('AXP', { exact: true })).toHaveCount(0);
  });

  expect(consoleErrors, 'browser console errors').toEqual([]);
});
