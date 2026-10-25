import type { EdgeBaseline } from '../backtest/baseline';
import { StrategyType } from '../types';
// Not edgeBaseline.json: Node resolves .json before ts-node's .ts, which would shadow this module in dev.
import baseline from './edge-baseline.json';

/**
 * The out-of-sample edge goals are judged against. Regenerate after a strategy, exit or gating
 * change with `npm run backtest -- --universe --years 10 --split 2023-01-01 --write-baseline`.
 */
export const EDGE_BASELINE = baseline as EdgeBaseline;

/**
 * Expected P&L of a setup: the baseline's expectancy per R times the dollars it risks.
 * Null for strategies the baseline did not measure.
 */
export function expectedValue(strategy: StrategyType, riskDollars: number): number | null {
  if (!EDGE_BASELINE.source.strategies.includes(strategy)) return null;
  return Math.round(EDGE_BASELINE.expectancyR * riskDollars * 100) / 100;
}

/** Order setups by expected value (unmeasured ones last), then score. */
export function byExpectedValue(a: { expectedValue: number | null; score: number }, b: { expectedValue: number | null; score: number }): number {
  return (b.expectedValue ?? -Infinity) - (a.expectedValue ?? -Infinity) || b.score - a.score;
}
