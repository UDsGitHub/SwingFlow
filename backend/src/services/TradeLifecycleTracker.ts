import { supabaseAdmin } from '../db/supabase';
import { mapTradeSetupRow } from '../db/tradeSetupMapper';
import { getProviderForUser } from '../providers/resolveUserProvider';
import { TradeSetup } from '../types';

export class TradeLifecycleTracker {
  async run(): Promise<void> {
    const enabled = (process.env.ENABLE_LIFECYCLE_AUTOMATION ?? 'true') === 'true';
    if (!enabled) return;

    const { data: rows, error } = await supabaseAdmin
      .from('trade_setups')
      .select('*')
      .in('status', ['ACTIVE', 'TRIGGERED']);

    if (error || !rows?.length) return;

    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const uid = row.user_id as string;
      const list = grouped.get(uid) ?? [];
      list.push(row);
      grouped.set(uid, list);
    }

    for (const [userId, setups] of grouped.entries()) {
      const provider = await getProviderForUser(userId);
      for (const raw of setups) {
        const setup = mapTradeSetupRow(raw);
        try {
          const bars = await provider.getHistoricalPrices(setup.symbol, 2);
          if (!bars.length) continue;
          const price = bars[bars.length - 1].close;
          await this.transition(setup, userId, price);
        } catch (err) {
          console.warn(`[Lifecycle] Price fetch failed for ${setup.symbol}:`, err);
        }
      }
    }
  }

  private async transition(setup: TradeSetup, userId: string, currentPrice: number): Promise<void> {
    const now = Date.now();
    if (setup.status === 'ACTIVE' && currentPrice >= setup.entry) {
      await supabaseAdmin.from('trade_setups').update({
        status: 'TRIGGERED',
        entry_hit_at: now,
      }).eq('id', setup.id).eq('user_id', userId);
      return;
    }

    if (setup.status === 'TRIGGERED') {
      if (currentPrice <= setup.stop) {
        const pnl = Number((currentPrice - setup.entry) * (setup.stockSuggestion?.shares ?? 1)).toFixed(2);
        await supabaseAdmin.from('trade_setups').update({
          status: 'STOPPED',
          stop_hit_at: now,
          closed_at: now,
          exit_price: currentPrice,
          realized_pnl: Number(pnl),
          pnl_estimate: Number(pnl),
        }).eq('id', setup.id).eq('user_id', userId);
        return;
      }

      if (currentPrice >= setup.target) {
        const pnl = Number((currentPrice - setup.entry) * (setup.stockSuggestion?.shares ?? 1)).toFixed(2);
        await supabaseAdmin.from('trade_setups').update({
          status: 'TARGET_HIT',
          target_hit_at: now,
          closed_at: now,
          exit_price: currentPrice,
          realized_pnl: Number(pnl),
          pnl_estimate: Number(pnl),
        }).eq('id', setup.id).eq('user_id', userId);
      }
    }
  }
}

