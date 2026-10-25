import { expect, test } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { TEST_USER_EMAIL, localSupabase } from '../support/env';

// Paper-tracked setups are written by the scheduler in production; here they are seeded
// directly so the UI for each lifecycle state can be checked deterministically.
test('shows paper-tracked setups: open with a trailing stop, and closed in R', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const [user] = (await clerkClient.users.getUserList({ emailAddress: [TEST_USER_EMAIL] })).data;
  const sb = localSupabase();
  const db = createClient(sb.url, sb.serviceRoleKey, { auth: { persistSession: false } });

  const base = {
    user_id: user.id, strategy: 'REVERSAL', direction: 'LONG', confidence: 72, risk_reward: 2.5, detected_at: Date.now(),
    signal_date: '2026-10-16', exit_plan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 }, atr_at_signal: 2,
    stock_suggestion: { shares: 10, capitalRequired: 1000, riskDollars: 75, potentialGainDollars: 187.5 },
  };
  await db.from('trade_setups').delete().eq('user_id', user.id).in('symbol', ['ZPAPA', 'ZPAPB']);
  const { data: seeded, error } = await db.from('trade_setups').insert([
    { ...base, symbol: 'ZPAPA', status: 'TRIGGERED', entry: 50, stop: 47, target: 57.5, current_stop: 49.25,
      paper_fill_price: 50.02, paper_fill_date: '2026-10-19', sessions_held: 5, managed_through: '2026-10-23' },
    { ...base, symbol: 'ZPAPB', status: 'CLOSED', entry: 80, stop: 76, target: 90, current_stop: 84.1,
      paper_fill_price: 80.04, paper_fill_date: '2026-10-19', paper_exit_price: 84.06, paper_exit_date: '2026-10-22',
      paper_exit_reason: 'TRAIL_STOP', paper_r: 1.0, sessions_held: 4, managed_through: '2026-10-22' },
  ]).select('id, symbol');
  expect(error).toBeNull();
  const closedId = seeded!.find(s => s.symbol === 'ZPAPB')!.id;

  await page.addInitScript(() => localStorage.setItem('swingflow_tour_done', '1'));
  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
  await page.goto('/');

  await test.step('an open paper trade shows its fill and raised trailing stop', async () => {
    const card = page.locator('#tour-setups').locator('div.group').filter({ hasText: 'ZPAPA' });
    await expect(card.getByTestId('paper-status')).toHaveText('Triggered $50.02');
    await expect(card).toContainText('Trail stop');
    await expect(card).toContainText('$49.25');
    await expect(card).toContainText('Trailing');
  });

  await test.step('the strategy record lists the closed paper trade in R', async () => {
    await page.getByRole('link', { name: 'History' }).click();
    await page.getByRole('tab', { name: 'Strategy record' }).click();
    const row = page.locator('[data-sf-history-row]').filter({ hasText: 'ZPAPB' });
    await expect(row).toContainText('Trailing stop');
    await expect(row).toContainText('+1.0R');
  });

  await test.step('the setup page shows the paper timeline', async () => {
    await page.goto(`/setup/${closedId}`);
    const record = page.locator('#paper-record');
    await expect(record).toContainText('Closed +1.0R');
    await expect(record).toContainText('Filled $80.04 on 2026-10-19');
    await expect(record).toContainText('Trailing stop at $84.06 on 2026-10-22');
  });

  expect(consoleErrors, 'browser console errors').toEqual([]);
});
