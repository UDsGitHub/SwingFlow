import { v4 as uuidv4 } from 'uuid';
import { getProviderForUser } from '../providers/resolveUserProvider';
import { TrendPullbackStrategy } from './TrendPullbackStrategy';
import { BreakoutStrategy } from './BreakoutStrategy';
import { ReversalStrategy } from './ReversalStrategy';
import { TradeSetup, OptionsChain } from '../types';
import { PositionSizingService } from '../services/PositionSizingService';
import { supabaseAdmin } from '../db/supabase';

const strategies = [
  new TrendPullbackStrategy(),
  new BreakoutStrategy(),
  new ReversalStrategy(),
];

export async function runStrategyEngine(
  watchlist: string[],
  userId: string,
): Promise<TradeSetup[]> {
  const sizing = new PositionSizingService();
  const setups: TradeSetup[] = [];

  const { data: cfg } = await supabaseAdmin
    .from('settings')
    .select('account_size, risk_percent')
    .eq('user_id', userId)
    .single();

  const provider = await getProviderForUser(userId);
  const accountSize = Number(cfg?.account_size ?? 5000);
  const riskPercent = Number(cfg?.risk_percent ?? 1.5);

  for (const symbol of watchlist) {
    try {
      const [ohlc, indicators] = await Promise.all([
        provider.getHistoricalPrices(symbol, 120),
        provider.getIndicators(symbol),
      ]);

      let optionsChain: OptionsChain | null = null;
      try { optionsChain = await provider.getOptionsChain(symbol); } catch { /* optional */ }

      for (const strategy of strategies) {
        const result = strategy.evaluate(symbol, ohlc, indicators);
        if (!result.triggered) continue;

        // Skip if an active setup already exists for this user+symbol+strategy
        const { data: existing } = await supabaseAdmin
          .from('trade_setups')
          .select('id')
          .eq('user_id', userId)
          .eq('symbol', symbol)
          .eq('strategy', result.strategy)
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (existing) continue;

        const stockSuggestion = sizing.calculate({
          entry: result.entry, stop: result.stop, target: result.target,
          accountSize, riskPercent,
        });

        const optionsSuggestion = optionsChain
          ? sizing.calculateOptions(optionsChain, result.direction, result.entry, accountSize, riskPercent)
          : null;

        const riskReward = (result.target - result.entry) / (result.entry - result.stop);

        const setup: TradeSetup = {
          id: uuidv4(),
          symbol,
          strategy: result.strategy,
          direction: result.direction,
          entry: result.entry,
          stop: result.stop,
          target: result.target,
          confidence: result.confidence,
          riskReward: Math.round(riskReward * 10) / 10,
          detectedAt: Date.now(),
          status: 'ACTIVE',
          notes: result.notes,
          stockSuggestion,
          optionsSuggestion,
          exitPrice:    null,
          realizedPnl:  null,
          closedAt:     null,
        };

        const { error } = await supabaseAdmin.from('trade_setups').insert({
          id:                setup.id,
          user_id:           userId,
          symbol:            setup.symbol,
          strategy:          setup.strategy,
          direction:         setup.direction,
          entry:             setup.entry,
          stop:              setup.stop,
          target:            setup.target,
          confidence:        setup.confidence,
          risk_reward:       setup.riskReward,
          detected_at:       setup.detectedAt,
          status:            setup.status,
          notes:             setup.notes,
          stock_suggestion:  setup.stockSuggestion,
          options_suggestion: setup.optionsSuggestion,
        });

        if (!error) {
          setups.push(setup);
          console.log(`[StrategyEngine] ${userId.slice(0, 8)}… — New setup: ${symbol} ${result.strategy} @ ${result.entry}`);
        }
      }
    } catch (err) {
      console.error(`[StrategyEngine] Error processing ${symbol}:`, err);
    }
  }

  return setups;
}
