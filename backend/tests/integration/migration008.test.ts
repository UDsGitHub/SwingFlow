import { execSync } from 'child_process';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from './helpers';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const sh = (cmd: string) => execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8' });

/** PostgREST does not reload its schema cache on its own; a stale cache can still see 001's uuid user_id. */
const psql = (sql: string) => sh(`docker exec supabase_db_swingflow psql -v ON_ERROR_STOP=1 -U postgres -c "${sql}"`);
const reloadSchema = () => psql("NOTIFY pgrst, 'reload schema'");

/** After a reset the API gateway restarts and PostgREST reloads its schema; both can lag on CI. */
const TRANSIENT = /schema cache|type uuid|does not exist|relation|column|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|502|503/i;

async function retry<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const { data, error } = await fn();
      if (!error) return data;
      if (!TRANSIENT.test(error.message)) throw new Error(error.message);
      last = error;
    } catch (err) {
      if (!TRANSIENT.test(String((err as Error)?.message ?? err))) throw err;
      last = err;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`database not available after reset: ${String((last as Error)?.message ?? last)}`);
}

afterAll(() => {
  // Leave the full schema in place for any test file that runs after this one.
  sh('supabase db reset --local');
});

describe('migration 008 on production-shaped settings', () => {
  it('keeps goal amounts, judges them per week, adds a 2% ceiling and clamps risk above it', async () => {
    sh('supabase db reset --local --version 007');
    reloadSchema();
    await retry(() => db.from('settings').insert([
      { user_id: 'user_a', account_size: 5000, daily_goal: 100, risk_percent: 1.5 },
      { user_id: 'user_b', account_size: 12000, daily_goal: 250, risk_percent: 3 },
      { user_id: 'user_c', account_size: null, daily_goal: null, risk_percent: null },
    ]));

    sh('supabase migration up --local');
    reloadSchema();

    const rows = await retry(() => db.from('settings')
      .select('user_id, account_size, goal_amount, goal_period, risk_percent, max_risk_percent')
      .order('user_id'));
    expect(rows).toEqual([
      { user_id: 'user_a', account_size: 5000, goal_amount: 100, goal_period: 'WEEKLY', risk_percent: 1.5, max_risk_percent: 2 },
      { user_id: 'user_b', account_size: 12000, goal_amount: 250, goal_period: 'WEEKLY', risk_percent: 2, max_risk_percent: 2 },
      { user_id: 'user_c', account_size: 5000, goal_amount: 100, goal_period: 'WEEKLY', risk_percent: 1.5, max_risk_percent: 2 },
    ]);

    // The database refuses risk above the ceiling and unknown periods even if the API is bypassed
    // (checked through psql: PostgREST's schema cache can still be reloading here).
    expect(() => psql("UPDATE settings SET risk_percent = 2.5 WHERE user_id = 'user_a'")).toThrow(/settings_risk_percent_check/);
    expect(() => psql("UPDATE settings SET goal_period = 'YEARLY' WHERE user_id = 'user_a'")).toThrow(/settings_goal_period_check/);
  });
});
