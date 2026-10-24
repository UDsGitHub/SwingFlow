import { supabaseAdmin } from '../db/supabase';
import { marketClock } from '../lib/marketTime';
import { ENTRY_WINDOW_DAYS } from '../strategies/strategyConfig';

/**
 * Expire ACTIVE (never filled) setups once ENTRY_WINDOW_DAYS completed sessions have passed
 * since their signal bar — the same entry window the backtest uses.
 *
 * @param sessionDates ascending ET dates of completed sessions, including the latest one
 */
export async function expireStaleSetups(sessionDates: string[]): Promise<number> {
  const { data: rows, error } = await supabaseAdmin
    .from('trade_setups')
    .select('id, signal_date, detected_at')
    .eq('status', 'ACTIVE');

  if (error) {
    console.warn('[Expiry] Failed to load active setups:', error.message);
    return 0;
  }

  const stale = (rows ?? []).filter((r: { signal_date: string | null; detected_at: number }) => {
    // Legacy rows have no signal date; fall back to the detection date.
    const signal = r.signal_date ?? marketClock(Number(r.detected_at)).date;
    return sessionDates.filter(d => d > signal).length >= ENTRY_WINDOW_DAYS;
  }).map((r: { id: string }) => r.id);

  if (!stale.length) return 0;

  const { error: updateErr } = await supabaseAdmin
    .from('trade_setups')
    .update({ status: 'EXPIRED' })
    .in('id', stale)
    .eq('status', 'ACTIVE');

  if (updateErr) {
    console.warn('[Expiry] Failed to expire setups:', updateErr.message);
    return 0;
  }
  console.log(`[Expiry] Expired ${stale.length} unfilled setup(s) after ${ENTRY_WINDOW_DAYS} sessions`);
  return stale.length;
}
