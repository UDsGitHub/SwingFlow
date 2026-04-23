import { supabaseAdmin } from '../db/supabase';
import { mapTradeSetupRow } from '../db/tradeSetupMapper';
import { getProviderForUser } from '../providers/resolveUserProvider';
import { NotificationService } from '../services/NotificationService';
import { TradeSetup } from '../types';

/** Min time between ENTRY_ZONE pushes for the same setup (dedupe / throttle). */
const ENTRY_ZONE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function priceInEntryZone(setup: TradeSetup, price: number): boolean {
  const band = setup.entry * 0.012;
  if (Math.abs(price - setup.entry) > band) return false;
  if (setup.direction === 'LONG') return price >= setup.stop * 0.999;
  return price <= setup.stop * 1.001;
}

async function hasRecentEntryZoneNotif(setupId: string): Promise<boolean> {
  const cutoff = Date.now() - ENTRY_ZONE_COOLDOWN_MS;
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('setup_id', setupId)
    .eq('type', 'ENTRY_ZONE')
    .gte('sent_at', cutoff)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * For every ACTIVE setup, if last price is within the entry band and we have not
 * notified recently, send ENTRY_ZONE push (same cadence as market scan via scheduler).
 */
export async function checkEntryZones(notifService: NotificationService): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('status', 'ACTIVE');

  if (error) {
    console.warn('[EntryZone] Failed to load active setups:', error.message);
    return;
  }
  if (!rows?.length) return;

  const byUser = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const uid = r.user_id as string;
    const list = byUser.get(uid) ?? [];
    list.push(r);
    byUser.set(uid, list);
  }

  let notified = 0;

  for (const [userId, userRows] of byUser) {
    try {
      const provider = await getProviderForUser(userId);
      for (const raw of userRows) {
        const setup = mapTradeSetupRow(raw);
        if (await hasRecentEntryZoneNotif(setup.id)) continue;

        let ohlc;
        try {
          ohlc = await provider.getHistoricalPrices(setup.symbol, 2);
        } catch (e) {
          console.warn(`[EntryZone] ${setup.symbol} price fetch failed:`, e);
          continue;
        }
        if (!ohlc?.length) continue;

        const price = ohlc[ohlc.length - 1].close;
        if (!priceInEntryZone(setup, price)) continue;

        await notifService.notifyEntryZone(userId, setup, Math.round(price * 100) / 100);
        notified++;
      }
    } catch (e) {
      console.error(`[EntryZone] user ${userId.slice(0, 8)}…:`, e);
    }
  }

  if (notified > 0) {
    console.log(`[EntryZone] Sent ${notified} entry-zone notification(s)`);
  }
}
