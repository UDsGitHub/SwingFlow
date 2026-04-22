import { v4 as uuidv4 } from 'uuid';
import { getProvider } from '../providers/ProviderFactory';
import { TrendPullbackStrategy } from './TrendPullbackStrategy';
import { BreakoutStrategy } from './BreakoutStrategy';
import { ReversalStrategy } from './ReversalStrategy';
import { TradeSetup, OptionsChain } from '../types';
import { PositionSizingService } from '../services/PositionSizingService';
import { getDb } from '../db/database';

const strategies = [
  new TrendPullbackStrategy(),
  new BreakoutStrategy(),
  new ReversalStrategy(),
];

export async function runStrategyEngine(watchlist: string[]): Promise<TradeSetup[]> {
  const provider = getProvider();
  const db = getDb();
  const sizing = new PositionSizingService();
  const setups: TradeSetup[] = [];

  const configRow = db.prepare('SELECT value FROM settings WHERE key = ?');
  const accountSize = Number((configRow.get('accountSize') as { value: string } | undefined)?.value ?? 5000);
  const riskPercent = Number((configRow.get('riskPercent') as { value: string } | undefined)?.value ?? 1.5);

  for (const symbol of watchlist) {
    try {
      const [ohlc, indicators] = await Promise.all([
        provider.getHistoricalPrices(symbol, 120),
        provider.getIndicators(symbol),
      ]);

      let optionsChain: OptionsChain | null = null;
      try {
        optionsChain = await provider.getOptionsChain(symbol);
      } catch {
        // options not available for all providers — graceful skip
      }

      for (const strategy of strategies) {
        const result = strategy.evaluate(symbol, ohlc, indicators);
        if (!result.triggered) continue;

        // Check if we already have an active setup for this symbol+strategy
        const existing = db.prepare(
          `SELECT id FROM trade_setups WHERE symbol = ? AND strategy = ? AND status = 'ACTIVE'`
        ).get(symbol, result.strategy);
        if (existing) continue;

        const stockSuggestion = sizing.calculate({
          entry: result.entry,
          stop: result.stop,
          target: result.target,
          accountSize,
          riskPercent,
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
        };

        // Persist
        db.prepare(`
          INSERT INTO trade_setups
            (id, symbol, strategy, direction, entry, stop, target, confidence, risk_reward, detected_at, status, notes, stock_suggestion, options_suggestion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          setup.id, setup.symbol, setup.strategy, setup.direction,
          setup.entry, setup.stop, setup.target, setup.confidence,
          setup.riskReward, setup.detectedAt, setup.status, setup.notes,
          JSON.stringify(setup.stockSuggestion),
          setup.optionsSuggestion ? JSON.stringify(setup.optionsSuggestion) : null,
        );

        setups.push(setup);
        console.log(`[StrategyEngine] New setup: ${symbol} ${result.strategy} @ ${result.entry}`);
      }
    } catch (err) {
      console.error(`[StrategyEngine] Error processing ${symbol}:`, err);
    }
  }

  return setups;
}
