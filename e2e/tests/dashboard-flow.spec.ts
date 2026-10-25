import { expect, test } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { TEST_USER_EMAIL } from '../support/env';

// Core user flow on the isolated stack (local Supabase + deterministic mock market pinned to
// Friday 2026-10-23 after the close, which yields Reversal setups for AXP and CB).
test('sign in, scan, take a setup, close it, see it in history, and set a realistic goal', async ({ page }) => {
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
    const goal = page.locator('#tour-goal');
    await expect(page.getByText("This week's P&L")).toBeVisible();
    await expect(goal).toContainText('$0');
    // The default $100/week on $5k is far beyond the backtested edge.
    await expect(goal.getByTestId('goal-feasibility')).toContainText('Unrealistic');
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

  await test.step('open the setup and record taking it', async () => {
    await setups.getByText('AXP', { exact: true }).click();
    await expect(page).toHaveURL(/\/setup\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'AXP' })).toBeVisible();
    await expect(page.locator('#paper-record')).toContainText('Waiting for entry');
    await page.getByLabel('Fill price').fill('98.40');
    await page.getByLabel('Shares').fill('17');
    await page.getByRole('button', { name: 'I took this trade' }).click();
    await expect(page.getByTestId('position-summary')).toContainText('17 sh @ $98.40');
  });

  await test.step('the position shows on the dashboard and can be closed', async () => {
    await page.getByRole('link', { name: 'Dashboard' }).click();
    const position = page.getByTestId('open-position').filter({ hasText: 'AXP' });
    await expect(position).toContainText('17 sh @ $98.40');
    await position.getByRole('button', { name: 'Close' }).click();
    const dialog = page.getByRole('dialog', { name: 'Close a trade' });
    await dialog.getByLabel('Exit Price').fill('104.40');
    await expect(dialog).toContainText('+$102.00'); // 17 × (104.40 − 98.40)
    await dialog.getByRole('button', { name: 'Record Close' }).click();
    await expect(page.locator('#tour-goal')).toContainText('$102');
    await expect(page.getByTestId('open-position')).toHaveCount(0);
  });

  await test.step('the closed trade appears in history', async () => {
    await page.getByRole('link', { name: 'History' }).click();
    const row = page.getByTestId('my-trade-row').filter({ hasText: 'AXP' });
    await expect(row).toContainText('+$102.00');
  });

  await test.step('settings judge the goal live and suggest a realistic one', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    const preview = page.getByTestId('goal-preview');
    await expect(page.getByTestId('goal-verdict')).toHaveText('Unrealistic');

    await page.getByLabel('Weekly Goal ($)').fill('1000');
    await expect(preview).toContainText('$1,000 / week');
    await expect(preview).toContainText('takes an account of about');

    // Risk can never be set above the ceiling.
    await page.getByLabel('Risk Per Trade (%)').fill('3');
    await page.getByLabel('Risk Per Trade (%)').blur();
    await expect(page.getByText('Above your 2% ceiling.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
    await page.getByLabel('Risk Per Trade (%)').fill('1.5');

    // Applying the suggestion only fills the form; Save persists it.
    await preview.getByRole('button', { name: /^Use \$\d+ \/ week$/ }).click();
    await expect(page.getByTestId('goal-verdict')).toHaveText('Realistic');
    const suggested = await page.getByLabel('Weekly Goal ($)').inputValue();
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Saved successfully')).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    const goal = page.locator('#tour-goal');
    await expect(goal).toContainText(`/ $${suggested} weekly goal`);
    await expect(goal.getByTestId('goal-feasibility')).toHaveText(/^Realistic/);
    await expect(goal).toContainText('100%'); // the $102 closed this week covers it
  });

  expect(consoleErrors, 'browser console errors').toEqual([]);
});
