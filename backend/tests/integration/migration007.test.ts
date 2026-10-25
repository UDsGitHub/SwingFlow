import { execSync } from 'child_process';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from './helpers';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const sh = (cmd: string) => execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8' });

/** Rebuild the local database at migration 006, before trade tracking existed. */
function resetTo006(): void {
  sh('supabase db reset --local --version 006');
}

/** Apply pending migrations, then tell PostgREST to reload its schema cache (it does not on its own). */
function migrateUp(): void {
  sh('supabase migration up --local');
  sh(`docker exec supabase_db_swingflow psql -U postgres -c "NOTIFY pgrst, 'reload schema'"`);
}

/** Rows shaped like production's before migration 007. */
function legacyRow(fields: Record<string, unknown>) {
  return {
    user_id: 'user_a', symbol: 'MSFT', strategy: 'REVERSAL', direction: 'LONG', entry: 100, stop: 95, target: 112.5,
    confidence: 70, risk_reward: 2.5, detected_at: 1, ...fields,
  };
}

async function insert(rows: Record<string, unknown>[]): Promise<void> {
  // PostgREST reloads its schema cache after the reset; retry briefly until it sees the tables.
  for (let attempt = 0; attempt < 20; attempt++) {
    const { error } = await db.from('trade_setups').insert(rows);
    if (!error) return;
    if (!/schema cache|does not exist|relation/.test(error.message)) throw error;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('trade_setups not available after reset');
}

afterAll(() => {
  // Leave the full schema in place for any test file that runs after this one.
  sh('supabase db reset --local');
});

describe('migration 007 on production-shaped data', () => {
  it('deletes old-tracker rows, keeps post-close-scan rows, and replays old TRIGGERED rows', async () => {
    resetTo006();
    await insert([
      // The 13 old-tracker outcomes and the 2 mock MSFT rows: no signal_date.
      ...Array.from({ length: 8 }, (_, i) => legacyRow({ symbol: `T${i}`, status: 'TARGET_HIT', realized_pnl: 50, entry_hit_at: 2 })),
      ...Array.from({ length: 5 }, (_, i) => legacyRow({ symbol: `S${i}`, status: 'STOPPED', realized_pnl: -30, entry_hit_at: 2 })),
      legacyRow({ symbol: 'MSFT', status: 'EXPIRED', entry_hit_at: 2 }),
      legacyRow({ symbol: 'MSFT', user_id: 'user_b', status: 'EXPIRED', entry_hit_at: 2 }),
      // Created by the post-close scan (have a signal date).
      legacyRow({ symbol: 'AXP', status: 'ACTIVE', signal_date: '2026-10-26' }),
      legacyRow({ symbol: 'CB', status: 'TRIGGERED', signal_date: '2026-10-26', entry_hit_at: 3 }),
      legacyRow({ symbol: 'T', status: 'EXPIRED', signal_date: '2026-10-21' }),
    ]);

    migrateUp();

    const { data, error } = await db.from('trade_setups').select('symbol, status, signal_date, entry_hit_at, current_stop, stop, tracking_version').order('symbol');
    expect(error).toBeNull();
    expect(data).toEqual([
      expect.objectContaining({ symbol: 'AXP', status: 'ACTIVE', current_stop: 95, tracking_version: 0 }),
      expect.objectContaining({ symbol: 'CB', status: 'ACTIVE', entry_hit_at: null, current_stop: 95 }),
      expect.objectContaining({ symbol: 'T', status: 'EXPIRED' }),
    ]);

    // New schema pieces are in place (PostgREST may take a moment to pick up the reload).
    let tradesError: unknown = 'not checked';
    for (let i = 0; i < 20 && tradesError; i++) {
      tradesError = (await db.from('trades').select('id').limit(1)).error;
      if (tradesError) await new Promise(r => setTimeout(r, 250));
    }
    expect(tradesError).toBeNull();
    const dup = legacyRow({ symbol: 'AXP', status: 'TRIGGERED', signal_date: '2026-10-27' });
    expect((await db.from('trade_setups').insert(dup)).error?.code).toBe('23505');
  });

  it('refuses to run when rows with old-tracker statuses carry a signal date', async () => {
    resetTo006();
    await insert([legacyRow({ symbol: 'AXP', status: 'TARGET_HIT', signal_date: '2026-10-26', realized_pnl: 10 })]);
    expect(() => sh('supabase migration up --local')).toThrow(/legacy statuses/);
  });
});
