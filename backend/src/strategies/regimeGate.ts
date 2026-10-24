import { RegimeSnapshot, StrategyType } from '../types';

/**
 * Which strategies may produce setups in each market regime (all strategies are long-only).
 * Reversal is profitable in every regime out-of-sample, so it is not gated.
 */
export function allowsRegime(strategy: StrategyType, regime: RegimeSnapshot['regime']): boolean {
  if ((process.env.ENABLE_REGIME_GATING ?? 'true') !== 'true') return true;
  if (strategy === 'TREND_PULLBACK') return regime === 'TRENDING_UP';
  if (strategy === 'BREAKOUT') return regime === 'TRENDING_UP' || regime === 'TRENDING_DOWN';
  return true;
}
