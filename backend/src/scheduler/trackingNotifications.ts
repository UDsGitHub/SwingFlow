import { supabaseAdmin } from '../db/supabase';
import { NotificationService } from '../services/NotificationService';
import { DigestInput, dailyDigestPayload, fillPayload } from '../services/notificationMessages';
import { TrackingEvent } from '../services/PaperTradeTracker';
import { PaperExitReason, TradeSetup } from '../types';

/** During market hours: one push per fill, skipping dismissed setups. */
export async function sendFillAlerts(events: TrackingEvent[], notif: NotificationService, now = Date.now()): Promise<number> {
  let sent = 0;
  for (const e of events) {
    if (e.type !== 'FILLED' || e.dismissed || e.fillPrice == null || e.stop == null) continue;
    await notif.send(e.userId, fillPayload({ setupId: e.setupId, symbol: e.symbol, fillPrice: e.fillPrice, stop: e.stop }), e.setupId);
    await supabaseAdmin.from('trade_setups').update({ fill_notified_at: now }).eq('id', e.setupId).is('fill_notified_at', null);
    sent++;
  }
  return sent;
}

/**
 * Everything worth telling a user after the close, read from the database so events from
 * earlier runs today (or a restart) are not lost.
 */
export async function collectDigest(
  userId: string,
  today: string,
  newSetups: TradeSetup[],
  events: TrackingEvent[],
): Promise<{ digest: DigestInput; fillIds: string[] }> {
  const [{ data: closed }, { data: filled }] = await Promise.all([
    supabaseAdmin.from('trade_setups')
      .select('symbol, paper_r, paper_exit_reason')
      .eq('user_id', userId).eq('status', 'CLOSED').eq('paper_exit_date', today).is('dismissed_at', null),
    supabaseAdmin.from('trade_setups')
      .select('id, symbol, paper_fill_price')
      .eq('user_id', userId).eq('paper_fill_date', today).is('fill_notified_at', null).is('dismissed_at', null),
  ]);

  const raises = events.filter(e => e.userId === userId && e.type === 'STOP_RAISED' && e.stop != null);
  let stopRaises: DigestInput['stopRaises'] = [];
  if (raises.length) {
    const { data: trades } = await supabaseAdmin.from('trades')
      .select('setup_id, stop_price')
      .eq('user_id', userId).eq('status', 'OPEN')
      .in('setup_id', raises.map(r => r.setupId));
    const held = new Map((trades ?? []).map((t: { setup_id: string; stop_price: number | null }) => [t.setup_id, t.stop_price]));
    stopRaises = raises
      .filter(r => held.has(r.setupId) && (held.get(r.setupId) == null || Number(held.get(r.setupId)) < (r.stop as number)))
      .map(r => ({ symbol: r.symbol, stop: r.stop as number }));
  }

  return {
    digest: {
      newSetups,
      fills: (filled ?? []).map((f: { symbol: string; paper_fill_price: number }) => ({ symbol: f.symbol, fillPrice: Number(f.paper_fill_price) })),
      closes: (closed ?? []).map((c: { symbol: string; paper_r: number; paper_exit_reason: PaperExitReason }) => ({
        symbol: c.symbol, r: Number(c.paper_r ?? 0), reason: c.paper_exit_reason,
      })),
      stopRaises,
    },
    fillIds: (filled ?? []).map((f: { id: string }) => f.id),
  };
}

/** After the close: at most one push per user, then mark the fills it covered as notified. */
export async function sendDailyDigest(
  userId: string,
  today: string,
  newSetups: TradeSetup[],
  events: TrackingEvent[],
  notif: NotificationService,
  now = Date.now(),
): Promise<boolean> {
  const { digest, fillIds } = await collectDigest(userId, today, newSetups, events);
  const payload = dailyDigestPayload(digest);
  if (!payload) return false;
  const setupId = payload.data.type === 'NEW_SETUP' ? (payload.data.setupId as string) : null;
  await notif.send(userId, payload, setupId);
  if (fillIds.length) await supabaseAdmin.from('trade_setups').update({ fill_notified_at: now }).in('id', fillIds);
  return true;
}
