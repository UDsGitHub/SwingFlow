import { supabaseAdmin } from '../db/supabase';
import { providerFromName } from '../providers/resolveUserProvider';
import { EXIT_PLANS } from '../strategies/strategyConfig';
import { OHLC } from '../types';
import {
  HISTORY_BARS, TrackedRow, TrackingEvent, advanceSetup, eventsFor, rowToState, stateToColumns,
} from '../trading/paperTracking';

export type { TrackingEvent, TrackingEventType } from '../trading/paperTracking';

/**
 * Track every open setup (waiting for entry or paper trade open).
 * - intraday: completed sessions plus today's forming bar (fills and stop hits as they happen).
 * - postClose: completed sessions only; today's bar is final after the close.
 * Updates are compare-and-set on tracking_version, so overlapping runs never double-apply.
 */
export async function trackOpenSetups(mode: 'intraday' | 'postClose', now = Date.now()): Promise<TrackingEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('id, user_id, symbol, strategy, status, entry, stop, target, signal_date, detected_at, exit_plan, atr_at_signal, current_stop, highest_high, sessions_waited, sessions_held, paper_fill_price, paper_fill_date, managed_through, dismissed_at, tracking_version')
    .in('status', ['ACTIVE', 'TRIGGERED']);
  if (error) {
    console.warn('[Tracker] Failed to load open setups:', error.message);
    return [];
  }
  const rows = (data ?? []) as TrackedRow[];
  if (!rows.length) return [];

  const provider = providerFromName(process.env.DATA_PROVIDER ?? 'alpaca');
  const barsBySymbol = new Map<string, OHLC[]>();
  for (const symbol of new Set(rows.map(r => r.symbol))) {
    try {
      barsBySymbol.set(symbol, await provider.getHistoricalPrices(symbol, HISTORY_BARS));
    } catch (err) {
      console.warn(`[Tracker] ${symbol} price fetch failed:`, (err as Error).message);
    }
  }

  const events: TrackingEvent[] = [];
  for (const row of rows) {
    const bars = barsBySymbol.get(row.symbol);
    if (!bars?.length) continue;

    const plan = row.exit_plan ?? EXIT_PLANS[row.strategy];
    const before = rowToState(row, plan);
    const { state: after, atr } = advanceSetup(row, bars, now, mode === 'intraday');
    const columns = stateToColumns(after);
    const unchanged = JSON.stringify(columns) === JSON.stringify(stateToColumns(before));
    const backfill = row.exit_plan == null || row.atr_at_signal == null;
    if (unchanged && !backfill) continue;

    const update: Record<string, unknown> = { ...columns, tracking_version: row.tracking_version + 1 };
    if (row.exit_plan == null) update.exit_plan = plan;
    if (row.atr_at_signal == null && Number.isFinite(atr)) update.atr_at_signal = atr;
    if (before.phase === 'PENDING' && after.fillPrice != null) update.entry_hit_at = now;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('trade_setups')
      .update(update)
      .eq('id', row.id)
      .eq('tracking_version', row.tracking_version)
      .select('id');
    if (updateErr) {
      console.warn(`[Tracker] Update failed for ${row.symbol} (${row.id.slice(0, 8)}):`, updateErr.message);
      continue;
    }
    // Another run changed this setup first; its events are its own to report.
    if (!updated?.length) continue;
    events.push(...eventsFor(row, before, after));
  }

  if (events.length) console.log(`[Tracker] ${mode}: ${events.map(e => `${e.symbol} ${e.type}`).join(', ')}`);
  return events;
}
