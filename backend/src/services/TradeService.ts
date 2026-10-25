import { supabaseAdmin } from '../db/supabase';
import { mapTradeRow } from '../db/tradeSetupMapper';
import { etDayRange, marketClock } from '../lib/marketTime';
import { Trade, TradeStatus } from '../types';
import { realizedPnl, validatePrice, validateShares } from '../trading/tradeMath';

const UNIQUE_VIOLATION = '23505';
const TRADE_SELECT = '*, trade_setups(current_stop, strategy)';

export type TradeResult =
  | { ok: true; trade: Trade }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string };

const fail = (status: 400 | 404 | 409 | 500, error: string): TradeResult => ({ ok: false, status, error });

/** Record that the user took a setup. One open trade per setup. */
export async function openTrade(
  userId: string,
  setupId: string,
  input: { fillPrice: unknown; shares: unknown; stopPrice?: unknown },
): Promise<TradeResult> {
  if (!validatePrice(input.fillPrice)) return fail(400, 'fillPrice must be a positive number');
  if (!validateShares(input.shares)) return fail(400, 'shares must be a positive whole number');
  if (input.stopPrice != null && !validatePrice(input.stopPrice)) return fail(400, 'stopPrice must be a positive number');

  const { data: setup } = await supabaseAdmin
    .from('trade_setups')
    .select('id, symbol, direction, stop, current_stop')
    .eq('id', setupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!setup) return fail(404, 'Setup not found');

  const stopPrice = (input.stopPrice as number | undefined) ?? Number(setup.current_stop ?? setup.stop);
  const { data, error } = await supabaseAdmin
    .from('trades')
    .insert({
      user_id: userId,
      setup_id: setup.id,
      symbol: setup.symbol,
      direction: setup.direction,
      entry_price: input.fillPrice,
      shares: input.shares,
      stop_price: stopPrice,
      status: 'OPEN',
      opened_at: Date.now(),
    })
    .select(TRADE_SELECT)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return fail(409, 'You already have an open trade on this setup');
  if (error || !data) return fail(500, error?.message ?? 'Could not record the trade');
  return { ok: true, trade: mapTradeRow(data) };
}

export async function closeTrade(userId: string, tradeId: string, exitPrice: unknown): Promise<TradeResult> {
  if (!validatePrice(exitPrice)) return fail(400, 'exitPrice must be a positive number');

  const { data: trade } = await supabaseAdmin
    .from('trades')
    .select('id, entry_price, shares, status')
    .eq('id', tradeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!trade) return fail(404, 'Trade not found');
  if (trade.status === 'CLOSED') return fail(409, 'This trade is already closed');

  // Guarded on status so two concurrent closes cannot both succeed.
  const { data, error } = await supabaseAdmin
    .from('trades')
    .update({
      status: 'CLOSED',
      exit_price: exitPrice,
      closed_at: Date.now(),
      realized_pnl: realizedPnl(Number(trade.entry_price), exitPrice, Number(trade.shares)),
    })
    .eq('id', tradeId)
    .eq('user_id', userId)
    .eq('status', 'OPEN')
    .select(TRADE_SELECT);
  if (error) return fail(500, error.message);
  if (!data?.length) return fail(409, 'This trade is already closed');
  return { ok: true, trade: mapTradeRow(data[0]) };
}

/** Update the stop the user has at their broker (e.g. after a "raise your stop" alert), or notes. */
export async function updateTrade(userId: string, tradeId: string, input: { stopPrice?: unknown; notes?: unknown }): Promise<TradeResult> {
  const update: Record<string, unknown> = {};
  if (input.stopPrice !== undefined) {
    if (!validatePrice(input.stopPrice)) return fail(400, 'stopPrice must be a positive number');
    update.stop_price = input.stopPrice;
  }
  if (input.notes !== undefined) {
    if (input.notes !== null && typeof input.notes !== 'string') return fail(400, 'notes must be text');
    update.notes = input.notes;
  }
  if (!Object.keys(update).length) return fail(400, 'Nothing to update');

  const { data, error } = await supabaseAdmin
    .from('trades')
    .update(update)
    .eq('id', tradeId)
    .eq('user_id', userId)
    .select(TRADE_SELECT);
  if (error) return fail(500, error.message);
  if (!data?.length) return fail(404, 'Trade not found');
  return { ok: true, trade: mapTradeRow(data[0]) };
}

export async function listTrades(userId: string, status?: TradeStatus): Promise<Trade[]> {
  let q = supabaseAdmin.from('trades').select(TRADE_SELECT).eq('user_id', userId).order('opened_at', { ascending: false }).limit(500);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTradeRow);
}

/** Realized P&L of real trades closed during an ET calendar day (today by default). */
export async function dailyRealizedPnl(userId: string, date = marketClock().date): Promise<number> {
  const { start, end } = etDayRange(date);
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('realized_pnl')
    .eq('user_id', userId)
    .eq('status', 'CLOSED')
    .gte('closed_at', start)
    .lt('closed_at', end);
  if (error) throw new Error(error.message);
  return Math.round((data ?? []).reduce((sum, r: { realized_pnl: number }) => sum + Number(r.realized_pnl), 0) * 100) / 100;
}
