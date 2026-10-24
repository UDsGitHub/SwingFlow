import { vi } from 'vitest';
import { supabaseAdmin as db } from '../../src/db/supabase';

/** Tables and a column every row has, used to delete all rows (PostgREST requires a filter). */
const TABLES: [string, string][] = [
  ['notification_attempts', 'user_id'],
  ['notifications', 'user_id'],
  ['scan_evaluations', 'user_id'],
  ['developing_candidates', 'user_id'],
  ['trade_setups', 'user_id'],
  ['scan_runs', 'kind'],
  ['push_subscriptions', 'user_id'],
  ['watchlist', 'user_id'],
  ['settings', 'user_id'],
  ['profiles', 'id'],
];

export async function resetDb(): Promise<void> {
  for (const [table, column] of TABLES) {
    const { error } = await db.from(table).delete().neq(column, '__none__');
    if (error) throw new Error(`reset ${table}: ${error.message}`);
  }
}

export async function createUser(id: string, favorites: string[] = []): Promise<void> {
  await db.from('profiles').insert({ id });
  await db.from('settings').insert({ user_id: id });
  if (favorites.length) {
    await db.from('watchlist').insert(favorites.map(symbol => ({ user_id: id, symbol, added_at: Date.now(), is_active: true })));
  }
}

/** Pin both the app clock and the simulated market to the same instant. */
export function setClock(iso: string): void {
  vi.setSystemTime(new Date(iso));
  process.env.MOCK_MARKET_TIME = iso;
}

export { db };
